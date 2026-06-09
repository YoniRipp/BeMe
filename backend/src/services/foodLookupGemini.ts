/**
 * Gemini-based food lookup when the food is not in the DB.
 * Returns nutrition per 100g or per 100ml (one row); inserts into foods and returns it.
 */
import { z } from 'zod';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { recordGeminiCall } from '../lib/metrics.js';
import { getModel, SAFETY_BLOCK_NONE } from '../lib/genai.js';

const FOOD_LOOKUP_PROMPT = `You are a nutrition data assistant. Given a food or drink name, return exactly one JSON object (no array, no markdown, no code fence) with nutrition per 100g for solid foods or per 100ml for liquids.

Response shape (use these exact keys):
{
  "name": "Official or common name in English",
  "calories": number (kcal per 100g or 100ml),
  "protein": number (g),
  "carbs": number (g),
  "fat": number (g),
  "is_liquid": boolean (true for drinks: soda, juice, coffee, milk, etc.),
  "serving_sizes_ml": { "can": number, "bottle": number, "glass": number } in ml, only for liquids; omit or null for solids,
  "default_unit": string or null (for foods naturally counted in units like eggs, slices, cans — e.g. "egg", "slice", "can", "tortilla". null for bulk foods like chicken, rice, etc.),
  "unit_weight_grams": number or null (grams per 1 unit when default_unit is set — e.g. 50 for an egg, 30 for a bread slice. null when default_unit is null),
  "search_aliases": array of strings or null (common informal names, abbreviations, or regional names for this food — e.g. ["coke zero", "zero"] for "Coca-Cola Zero Sugar". null if no common aliases)
}

Rules:
- One object only. No array, no extra text.
- For countable foods (eggs, bread slices, tortillas, meatballs, dumplings, etc.) set default_unit and unit_weight_grams. For bulk/weighed foods (chicken breast, rice, etc.) leave both null.
- For branded or commonly nicknamed foods, include search_aliases with common names people use. For generic foods, set search_aliases to null.
- Include "cooked" or "uncooked" in the name when relevant. Use the word "uncooked" only (not "raw") for consistency. Default to cooked: e.g. "chicken breast" or "rice" → "Chicken breast, cooked" or "Rice, cooked". Only if the user says "uncooked" or "raw" use ", uncooked" (e.g. "Rice, uncooked"). For drinks, no need to add.
- For drinks (soda, juice, coffee, tea, milk, etc.) set is_liquid true and provide per 100ml values; include serving_sizes_ml with typical can (e.g. 330), bottle (e.g. 500), glass (e.g. 250).
- For solid foods set is_liquid false; serving_sizes_ml can be null or omitted.
- Use realistic values. If unsure, use reasonable estimates.`;

const GeminiFoodSchema = z.object({
  name: z.string().min(1).transform((s) => s.trim()),
  calories: z.number().min(0).max(1000),
  protein: z.number().min(0).max(100),
  carbs: z.number().min(0).max(100),
  fat: z.number().min(0).max(100),
  is_liquid: z.boolean(),
  serving_sizes_ml: z
    .object({
      can: z.number().min(0).max(2000).optional(),
      bottle: z.number().min(0).max(5000).optional(),
      glass: z.number().min(0).max(1000).optional(),
    })
    .nullable()
    .optional(),
  default_unit: z.string().min(1).nullable().optional(),
  unit_weight_grams: z.number().min(1).max(5000).nullable().optional(),
  search_aliases: z.array(z.string().min(1)).nullable().optional(),
});

function extractJson(text: unknown) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  const stripped = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const first = stripped.match(/\{[\s\S]*\}/);
    if (first) {
      try {
        return JSON.parse(first[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Check if a similar-named food already exists to avoid duplicates.
 */
async function findExistingByName(pool: { query: (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }, name: string) {
  const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
  const result = await pool.query(
    `SELECT id, name, calories, protein, carbs, fat, is_liquid, serving_sizes_ml, default_unit, unit_weight_grams
     FROM foods
     WHERE lower(trim(regexp_replace(name, '\\s+', ' ', 'g'))) = $1
        OR $1 = ANY(search_aliases)
     LIMIT 1`,
    [normalized]
  );
  return result.rows[0] || null;
}

type FoodPool = { query: (sql: string, params: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> };
type FoodRow = Awaited<ReturnType<typeof doLookupAndCreateFood>>;

/** Coalesce concurrent lookups for the same food so we make ONE Gemini call + insert. */
const inFlight = new Map<string, Promise<FoodRow>>();

function normalizeKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** One Gemini text generation with a single retry on transient failure. */
async function generateFoodJson(name: string): Promise<string | null> {
  const model = getModel({ model: config.geminiModel, safetySettings: SAFETY_BLOCK_NONE });
  const prompt = `${FOOD_LOOKUP_PROMPT}\n\nFood or drink name: ${name}`;
  const contents = [{ role: 'user', parts: [{ text: prompt }] }];

  for (let attempt = 0; attempt < 2; attempt++) {
    const geminiStart = Date.now();
    try {
      const result = await model.generateContent({ contents });
      recordGeminiCall(Date.now() - geminiStart, true);
      const response = result.response;
      const text = response?.text?.();
      return text ?? null;
    } catch (e: unknown) {
      recordGeminiCall(Date.now() - geminiStart, false);
      if (attempt === 0) {
        logger.warn({ err: e, name }, 'foodLookupGemini generateContent failed, retrying');
        await new Promise((r) => setTimeout(r, 300));
        continue;
      }
      logger.error({ err: e }, 'foodLookupGemini generateContent');
      return null;
    }
  }
  return null;
}

/**
 * Look up a food by name via Gemini, optionally insert into foods, and return the row (per 100g or 100ml).
 * Concurrent calls for the same name share a single in-flight lookup to avoid
 * duplicate Gemini calls and duplicate `foods` rows (cache stampede).
 */
export function lookupAndCreateFood(pool: FoodPool, foodName: string, options: { liquidHint?: boolean } = {}): Promise<FoodRow> {
  const name = typeof foodName === 'string' ? foodName.trim() : '';
  if (!name) return Promise.resolve(null);
  if (!config.geminiApiKey) return Promise.resolve(null);

  const key = normalizeKey(name);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = doLookupAndCreateFood(pool, name, options).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

async function doLookupAndCreateFood(pool: FoodPool, name: string, _options: { liquidHint?: boolean } = {}) {
  const text = await generateFoodJson(name);
  if (!text) return null;

  const raw = extractJson(text);
  if (!raw) return null;

  const parsed = GeminiFoodSchema.safeParse(raw);
  if (!parsed.success) return null;
  const data = parsed.data;

  const nameForDb = String(data.name || '').replace(/\braw\b/gi, 'uncooked');
  const preparation = /\b(uncooked|raw)\b/i.test(data.name || '') ? 'uncooked' : 'cooked';

  const existing = await findExistingByName(pool, nameForDb);
  if (existing) {
    const displayName = String(existing.name || '').replace(/\braw\b/gi, 'uncooked');
    return {
      id: existing.id,
      name: displayName,
      calories: Number(existing.calories),
      protein: Number(existing.protein),
      carbs: Number(existing.carbs),
      fat: Number(existing.fat),
      is_liquid: Boolean(existing.is_liquid),
      serving_sizes_ml: existing.serving_sizes_ml ?? null,
      default_unit: (existing.default_unit as string) ?? null,
      unit_weight_grams: existing.unit_weight_grams != null ? Number(existing.unit_weight_grams) : null,
    };
  }

  const servingSizesMl = data.is_liquid && data.serving_sizes_ml
    ? JSON.stringify(data.serving_sizes_ml)
    : null;

  const insertResult = await pool.query(
    `INSERT INTO foods (name, common_name, calories, protein, carbs, fat, is_liquid, serving_sizes_ml, preparation, default_unit, unit_weight_grams, search_aliases, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::text[], 'gemini')
     RETURNING id, name, common_name, calories, protein, carbs, fat, is_liquid, serving_sizes_ml, default_unit, unit_weight_grams`,
    [
      nameForDb,
      nameForDb,  // common_name = name for Gemini foods (already clean)
      data.calories,
      data.protein,
      data.carbs,
      data.fat,
      data.is_liquid,
      servingSizesMl,
      preparation,
      data.default_unit ?? null,
      data.unit_weight_grams ?? null,
      data.search_aliases ?? null,
    ]
  );
  const row = insertResult.rows[0];
  const displayName = String(row.name || '').replace(/\braw\b/gi, 'uncooked');
  return {
    id: row.id,
    name: displayName,
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    is_liquid: Boolean(row.is_liquid),
    serving_sizes_ml: row.serving_sizes_ml ?? null,
    default_unit: (row.default_unit as string) ?? null,
    unit_weight_grams: row.unit_weight_grams != null ? Number(row.unit_weight_grams) : null,
  };
}
