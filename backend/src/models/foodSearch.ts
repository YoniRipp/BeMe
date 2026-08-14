/**
 * Food search model — foods table lookup (name, calories, protein, carbs, fat).
 * Supports common_name for user-friendly display of USDA foods.
 */
import { Pool } from 'pg';
import { getPool } from '../db/pool.js';
import { escapeLike } from '../utils/escapeLike.js';

const REFERENCE_GRAMS = 100;

// ---------------------------------------------------------------------------
// Common-name extraction from USDA descriptive names
// ---------------------------------------------------------------------------

/** Words that are key qualifiers — kept in the common name. */
const KEEP_QUALIFIERS = new Set([
  'white', 'brown', 'whole', 'skim', 'nonfat', 'lowfat', 'low-fat',
  'breast', 'thigh', 'leg', 'wing', 'drumstick', 'ground', 'lean',
  'dark', 'light', 'sweet', 'wild', 'basmati', 'jasmine',
  'long-grain', 'long grain', 'medium-grain', 'medium grain',
  'short-grain', 'short grain', 'whole wheat', 'whole-wheat',
  'yellow', 'red', 'green', 'black', 'pinto', 'navy', 'kidney',
  'cheddar', 'mozzarella', 'parmesan', 'swiss', 'provolone', 'gouda',
  'atlantic', 'pacific', 'chinook', 'sockeye', 'pink',
  'extra lean', 'extra-lean',
  'fresh', 'frozen', 'canned', 'dried',
]);

/** Cooking methods — kept at the end of common name. */
const COOKING_METHODS = new Set([
  'cooked', 'raw', 'uncooked', 'grilled', 'baked', 'fried',
  'boiled', 'steamed', 'roasted', 'scrambled', 'poached',
  'braised', 'sauteed', 'sautéed', 'broiled', 'smoked',
  'stewed', 'microwaved', 'pan-fried',
]);

/** Noise segments to skip entirely. */
const NOISE_PATTERNS = [
  /^broilers?\s+or\s+fryers?$/i,
  /^meat\s+only$/i,
  /^skinless$/i,
  /^boneless$/i,
  /^without\s+skin$/i,
  /^with\s+skin$/i,
  /^skin\s+not\s+eaten$/i,
  /^separable\s+lean/i,
  /^enriched$/i,
  /^unenriched$/i,
  /^not\s+fortified$/i,
  /^fortified$/i,
  /^plain$/i,
  /^regular$/i,
  /^mature\s+seeds$/i,
  /^dry$/i,
  /^dry\s+form$/i,
  /^all\s+purpose$/i,
  /^all-purpose$/i,
  /^from\s+concentrate$/i,
  /^shelf\s+stable$/i,
  /^solids\s+and\s+liquids?$/i,
  /^drained\s+solids$/i,
  /^drained$/i,
  /^packed\s+in\s+/i,
  /^no\s+salt\s+added$/i,
  /^with\s+added\s+/i,
  /^without\s+added\s+/i,
  /^NFS$/i,
  /^NS\s+as\s+to\s+/i,
  /^\d+%\s+fat$/i,
  /^fat\s+free$/i,
  /^reduced\s+fat$/i,
  /^commercially\s+prepared$/i,
  /^made\s+with\s+/i,
  /^prepared\s+from\s+/i,
  /^pre-?cooked$/i,
  /^trimmed\s+to\s+/i,
  /^refuse\s*:/i,
  /^bone[- ]?in$/i,
  /^bone[- ]?less$/i,
];

function isNoise(segment: string): boolean {
  const s = segment.trim();
  if (!s) return true;
  return NOISE_PATTERNS.some((p) => p.test(s));
}

function isCookingMethod(segment: string): boolean {
  return COOKING_METHODS.has(segment.trim().toLowerCase());
}

/**
 * Extract a clean, user-friendly common name from a USDA description.
 *
 * "Chicken, broilers or fryers, breast, skinless, boneless, meat only, cooked, grilled"
 *  → "Chicken breast, grilled"
 *
 * "Rice, white, medium-grain, cooked"
 *  → "White rice"
 *
 * "Egg, whole, cooked, scrambled"
 *  → "Egg, scrambled"
 *
 * "Pasta, dry, enriched"
 *  → "Pasta"
 */
export function extractCommonName(usdaDescription: string): string {
  if (!usdaDescription || typeof usdaDescription !== 'string') return usdaDescription;

  const segments = usdaDescription.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return usdaDescription;

  const mainIngredient = segments[0];
  const qualifiers: string[] = [];
  const methods: string[] = [];

  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    if (isNoise(seg)) continue;
    if (isCookingMethod(seg)) {
      methods.push(seg.toLowerCase());
      continue;
    }
    const segLower = seg.toLowerCase();
    if (KEEP_QUALIFIERS.has(segLower)) {
      qualifiers.push(segLower);
      continue;
    }
    // Check multi-word: "whole wheat", "long grain", etc.
    const words = segLower.split(/\s+/);
    if (words.length <= 2 && words.some((w) => KEEP_QUALIFIERS.has(w))) {
      qualifiers.push(segLower);
    }
  }

  // Separate adjectives from noun-parts (breast, thigh, etc.)
  const NOUN_PARTS = new Set(['breast', 'thigh', 'leg', 'wing', 'drumstick', 'ground']);
  const adjectives: string[] = [];
  const nounParts: string[] = [];

  for (const q of qualifiers) {
    if (NOUN_PARTS.has(q)) {
      nounParts.push(q);
    } else {
      adjectives.push(q);
    }
  }

  // Build: "[Adjectives] MainIngredient [noun parts]"
  let commonName = '';
  if (adjectives.length > 0) {
    commonName = capitalize(adjectives.join(' ')) + ' ' + mainIngredient.toLowerCase();
  } else {
    commonName = capitalize(mainIngredient.toLowerCase());
  }
  if (nounParts.length > 0) {
    commonName += ' ' + nounParts.join(' ');
  }

  // Append specific cooking method (skip generic "cooked")
  if (methods.length > 0) {
    const specific = methods.filter((m) => m !== 'cooked' && m !== 'raw' && m !== 'uncooked');
    if (specific.length > 0) {
      commonName += ', ' + specific[specific.length - 1];
    }
  }

  return commonName.trim();
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Use "uncooked" consistently (not "raw") for display. */
function normalizePreparationName(name: string, preparation: string | null | undefined): string {
  if (!name || typeof name !== 'string') return name;
  const prep = (preparation || 'cooked').toLowerCase();
  if (prep === 'uncooked') return name.replace(/\braw\b/gi, 'uncooked');
  return name;
}

function rowToResult(row: Record<string, unknown>) {
  // Prefer common_name for display; fall back to full USDA name
  const rawName = (row.common_name as string) || (row.name as string);
  const name = normalizePreparationName(rawName, row.preparation as string | null);
  return {
    name,
    calories: Number(row.calories),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    referenceGrams: REFERENCE_GRAMS,
    isLiquid: Boolean(row.is_liquid),
    servingSizesMl: (row.serving_sizes_ml as unknown) ?? null,
    preparation: (row.preparation as string) ?? 'cooked',
    defaultUnit: (row.default_unit as string) ?? null,
    unitWeightGrams: row.unit_weight_grams != null ? Number(row.unit_weight_grams) : null,
    imageUrl: (row.image_url as string) ?? null,
  };
}

/** Approximate grams per unit for countable/portion items (e.g. eggs, bananas). */
const PORTION_GRAMS: Record<string, number> = {
  egg: 50, eggs: 50, banana: 120, bananas: 120, apple: 180, apples: 180,
  slice: 30, slices: 30, piece: 50, pieces: 50, serving: 100, servings: 100,
  // Meat cuts — average cooked weight per piece
  drumstick: 130, drumsticks: 130,
  thigh: 180, thighs: 180,
  breast: 175, breasts: 175,
  wing: 80, wings: 80,
  // Other common countable items
  sausage: 75, sausages: 75,
  meatball: 30, meatballs: 30,
  tortilla: 45, tortillas: 45,
  pancake: 75, pancakes: 75,
  waffle: 75, waffles: 75,
  cookie: 30, cookies: 30,
  falafel: 25, falafels: 25,
};

/**
 * Convert an amount + unit pair to grams.
 * @param unitWeightGrams Optional per-unit weight from the food's DB record (e.g. 130g for a drumstick).
 *   When the unit is not recognised in PORTION_GRAMS, this value is used as a per-unit weight.
 */
export function unitToGrams(amount: number | string, unit: string | null | undefined, unitWeightGrams?: number | null): number {
  const u = (unit || 'g').toLowerCase().replace(/\s+/g, '');
  const n = Number(amount);
  const num = Number.isFinite(n) && n > 0 ? n : 100;
  if (u === 'g') return num;
  if (u === 'kg') return num * 1000;
  if (u === 'ml' || u === 'l') return num * (u === 'l' ? 1000 : 1);
  if (['cup', 'tbsp', 'tsp'].includes(u)) return (u === 'cup' ? 240 : u === 'tbsp' ? 15 : 5) * num;
  if (PORTION_GRAMS[u] != null) return PORTION_GRAMS[u] * num;
  // Use per-unit weight from the food's DB record when available
  if (unitWeightGrams != null && unitWeightGrams > 0) return unitWeightGrams * num;
  return num;
}

// ---------------------------------------------------------------------------
// Word-split helpers
// ---------------------------------------------------------------------------

/** Split query into words for LIKE matching. */
function splitQueryWords(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
}

/** Escape special regex characters for PostgreSQL ~* operator. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a parameterized WHERE clause requiring ALL query words in a column.
 * "chicken breast" on column "lower(name)" with startIdx 3:
 *   sql: "(lower(name) LIKE $3 AND lower(name) LIKE $4)"
 *   values: ['%chicken%', '%breast%']
 */
function wordSplitLike(col: string, words: string[], startIdx: number): { sql: string; values: string[] } {
  if (words.length === 0) return { sql: 'FALSE', values: [] };
  const conditions = words.map((_, i) => `${col} LIKE $${startIdx + i}`);
  const values = words.map((w) => '%' + escapeLike(w) + '%');
  return { sql: conditions.length === 1 ? conditions[0] : `(${conditions.join(' AND ')})`, values };
}

/**
 * Word-boundary-aware matching using PostgreSQL regex ~*.
 * "cheese" matches "cream cheese" and "cheese, sliced" but NOT "cheesecake".
 * Uses \m (word start) and \M (word end) PostgreSQL regex anchors.
 */
function wordSplitWordBound(col: string, words: string[], startIdx: number): { sql: string; values: string[] } {
  if (words.length === 0) return { sql: 'FALSE', values: [] };
  const conditions = words.map((_, i) => `${col} ~* $${startIdx + i}`);
  const values = words.map((w) => '\\m' + escapeRegex(w) + '\\M');
  return { sql: conditions.length === 1 ? conditions[0] : `(${conditions.join(' AND ')})`, values };
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search foods with relevance ranking:
 * - Word-split matching: "chicken breast" finds entries where both words appear
 * - common_name priority: clean names ranked above raw USDA descriptions
 * - Trigram similarity: fuzzy matching for typos
 * - Full-text search: stemmed word matching
 */
export async function search(q: string, limit = 10) {
  const pool = getPool();
  const query = q.trim().toLowerCase();
  if (!query) return [];

  const words = splitQueryWords(query);

  // Parameter layout: $1=query, $2=prefix, $3=limit, $4+=word LIKE params
  const cnLike = wordSplitLike('lower(COALESCE(common_name, name))', words, 4);
  const nmLike = wordSplitLike('lower(name)', words, 4 + cnLike.values.length);
  const allValues = [query, escapeLike(query) + '%', limit, ...cnLike.values, ...nmLike.values];

  try {
    const sql = `
      SELECT id, name, common_name, calories, protein, carbs, fat, is_liquid, serving_sizes_ml, preparation, default_unit, unit_weight_grams, image_url
      FROM foods
      WHERE ${cnLike.sql}
         OR ${nmLike.sql}
         OR similarity(lower(COALESCE(common_name, name)), $1) > 0.15
         OR name_tsv @@ plainto_tsquery('english', $1)
         OR lower($1) = ANY(search_aliases)
      ORDER BY
        (lower(COALESCE(common_name, name)) = $1) DESC,
        (lower($1) = ANY(search_aliases)) DESC,
        (lower(COALESCE(common_name, name)) LIKE $2) DESC,
        CASE WHEN name_tsv @@ plainto_tsquery('english', $1) THEN 1 ELSE 0 END DESC,
        similarity(lower(COALESCE(common_name, name)), $1) DESC,
        (COALESCE(preparation, 'cooked') = 'cooked') DESC,
        length(COALESCE(common_name, name)) ASC
      LIMIT $3`;
    const result = await pool.query(sql, allValues);
    return result.rows.map(rowToResult);
  } catch {
    // Fallback tier 1: no pg_trgm / name_tsv / common_name / search_aliases
    const fbNm = wordSplitLike('lower(name)', words, 4);
    const fbValues = [query, escapeLike(query) + '%', limit, ...fbNm.values];

    try {
      const sql = `
        SELECT id, name, calories, protein, carbs, fat, is_liquid, serving_sizes_ml, preparation, default_unit, unit_weight_grams, image_url
        FROM foods
        WHERE ${fbNm.sql}
        ORDER BY
          (lower(name) = $1) DESC,
          (lower(name) LIKE $2) DESC,
          (COALESCE(preparation, 'cooked') = 'cooked') DESC,
          length(name) ASC,
          name
        LIMIT $3`;
      const result = await pool.query(sql, fbValues);
      return result.rows.map(rowToResult);
    } catch {
      // Fallback tier 2: only baseline columns
      const sql = `
        SELECT id, name, calories, protein, carbs, fat, is_liquid, serving_sizes_ml, preparation, image_url
        FROM foods
        WHERE ${fbNm.sql}
        ORDER BY
          (lower(name) = $1) DESC,
          (lower(name) LIKE $2) DESC,
          (COALESCE(preparation, 'cooked') = 'cooked') DESC,
          length(name) ASC,
          name
        LIMIT $3`;
      const result = await pool.query(sql, fbValues);
      return result.rows.map(rowToResult);
    }
  }
}

// ---------------------------------------------------------------------------
// Voice / single-food lookup
// ---------------------------------------------------------------------------

/**
 * Look up one food by name and return scaled nutrition.
 * Uses word-split matching so "chicken breast" finds USDA entries where the
 * words aren't adjacent. Prefers common_name matches.
 */
export async function getNutritionForFoodName(pool: Pool, foodName: string, amount: number | string, unit: string | null | undefined, preferUncooked = false) {
  const name = typeof foodName === 'string' ? foodName.trim() : '';
  if (!name) return null;
  const query = name.toLowerCase();
  const wantPrep = preferUncooked ? 'uncooked' : 'cooked';
  const words = splitQueryWords(query);

  // $1=query, $2=prefix, $3=wantPrep, $4+=word-boundary regex params
  const cnWord = wordSplitWordBound('lower(COALESCE(common_name, name))', words, 4);
  const nmWord = wordSplitWordBound('lower(name)', words, 4 + cnWord.values.length);
  const allValues = [query, escapeLike(query) + '%', wantPrep, ...cnWord.values, ...nmWord.values];

  let result;
  try {
    result = await pool.query(
      `SELECT id, name, common_name, calories, protein, carbs, fat, is_liquid, preparation, default_unit, unit_weight_grams
       FROM foods
       WHERE ${cnWord.sql} OR ${nmWord.sql}
          OR similarity(lower(COALESCE(common_name, name)), $1) > 0.6
       ORDER BY
         (lower(COALESCE(common_name, name)) = $1) DESC,
         (lower(COALESCE(common_name, name)) LIKE $2) DESC,
         similarity(lower(COALESCE(common_name, name)), $1) DESC,
         (COALESCE(preparation, 'cooked') = $3) DESC,
         length(COALESCE(common_name, name)) ASC
       LIMIT 1`,
      allValues
    );
  } catch {
    // Fallback without pg_trgm / common_name — use only guaranteed columns.
    // Params are [wantPrep, ...words], so word placeholders start at $2.
    const fbNm = wordSplitWordBound('lower(name)', words, 2);

    result = await pool.query(
      `SELECT id, name, calories, protein, carbs, fat, is_liquid, preparation
       FROM foods
       WHERE ${fbNm.sql}
       ORDER BY (COALESCE(preparation, 'cooked') = $1) DESC, length(name) ASC
       LIMIT 1`,
      [wantPrep, ...fbNm.values]
    );
  }

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  const foodUnitWeight = row.unit_weight_grams != null ? Number(row.unit_weight_grams) : null;
  const grams = unitToGrams(amount, unit, foodUnitWeight);
  const scale = grams / REFERENCE_GRAMS;
  const rawDisplayName = (row.common_name as string) || (row.name as string);
  const displayName = normalizePreparationName(rawDisplayName, row.preparation);
  return {
    name: displayName,
    calories: Math.round(Number(row.calories) * scale),
    protein: Math.round(Number(row.protein) * scale * 10) / 10,
    carbs: Math.round(Number(row.carbs) * scale * 10) / 10,
    fat: Math.round(Number(row.fat) * scale * 10) / 10,
    isLiquid: Boolean(row.is_liquid),
  };
}

// ---------------------------------------------------------------------------
// Barcode + cache
// ---------------------------------------------------------------------------

/** Look up a food by barcode (indexed). */
export async function getByBarcode(pool: Pool, barcode: string) {
  let result;
  try {
    result = await pool.query(
      `SELECT id, name, common_name, calories, protein, carbs, fat, is_liquid, serving_sizes_ml, preparation, barcode, image_url, default_unit, unit_weight_grams
       FROM foods WHERE barcode = $1 LIMIT 1`,
      [barcode]
    );
  } catch {
    try {
      // Fallback: common_name column may not exist yet
      result = await pool.query(
        `SELECT id, name, calories, protein, carbs, fat, is_liquid, serving_sizes_ml, preparation, barcode, image_url, default_unit, unit_weight_grams
         FROM foods WHERE barcode = $1 LIMIT 1`,
        [barcode]
      );
    } catch {
      // Fallback: default_unit/unit_weight_grams may not exist either
      result = await pool.query(
        `SELECT id, name, calories, protein, carbs, fat, is_liquid, serving_sizes_ml, preparation, barcode, image_url
         FROM foods WHERE barcode = $1 LIMIT 1`,
        [barcode]
      );
    }
  }
  if (result.rows.length === 0) return null;
  return { ...rowToResult(result.rows[0]), barcode: result.rows[0].barcode as string | null, imageUrl: result.rows[0].image_url as string | null };
}

/** Insert a food from OFF or Gemini into the local DB (auto-cache). Returns the inserted row. */
export async function cacheFood(pool: Pool, food: {
  name: string;
  name_he?: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  is_liquid: boolean;
  barcode?: string | null;
  source: string;
  off_id?: string | null;
  image_url?: string | null;
  preparation?: string;
  default_unit?: string | null;
  unit_weight_grams?: number | null;
  search_aliases?: string[] | null;
}) {
  // For OFF/Gemini foods, the name is already clean — use it as common_name too
  let result;
  try {
    result = await pool.query(
      `INSERT INTO foods (name, common_name, name_he, calories, protein, carbs, fat, is_liquid, barcode, source, off_id, image_url, preparation, default_unit, unit_weight_grams, search_aliases)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::text[])
       ON CONFLICT (off_id) WHERE off_id IS NOT NULL DO UPDATE SET
         name = EXCLUDED.name,
         common_name = EXCLUDED.common_name,
         calories = EXCLUDED.calories, protein = EXCLUDED.protein,
         carbs = EXCLUDED.carbs, fat = EXCLUDED.fat,
         is_liquid = EXCLUDED.is_liquid, image_url = EXCLUDED.image_url,
         default_unit = EXCLUDED.default_unit, unit_weight_grams = EXCLUDED.unit_weight_grams
       RETURNING id, name, common_name, calories, protein, carbs, fat, is_liquid, serving_sizes_ml, preparation, barcode, image_url, default_unit, unit_weight_grams`,
      [food.name, food.name, food.name_he ?? null, food.calories, food.protein, food.carbs, food.fat,
       food.is_liquid, food.barcode ?? null, food.source, food.off_id ?? null, food.image_url ?? null, food.preparation ?? 'cooked',
       food.default_unit ?? null, food.unit_weight_grams ?? null, food.search_aliases ?? null]
    );
  } catch {
    try {
      // Fallback: common_name column may not exist yet
      result = await pool.query(
        `INSERT INTO foods (name, name_he, calories, protein, carbs, fat, is_liquid, barcode, source, off_id, image_url, preparation, default_unit, unit_weight_grams, search_aliases)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::text[])
         ON CONFLICT (off_id) WHERE off_id IS NOT NULL DO UPDATE SET
           name = EXCLUDED.name, calories = EXCLUDED.calories, protein = EXCLUDED.protein,
           carbs = EXCLUDED.carbs, fat = EXCLUDED.fat, is_liquid = EXCLUDED.is_liquid, image_url = EXCLUDED.image_url,
           default_unit = EXCLUDED.default_unit, unit_weight_grams = EXCLUDED.unit_weight_grams
         RETURNING id, name, calories, protein, carbs, fat, is_liquid, serving_sizes_ml, preparation, barcode, image_url, default_unit, unit_weight_grams`,
        [food.name, food.name_he ?? null, food.calories, food.protein, food.carbs, food.fat,
         food.is_liquid, food.barcode ?? null, food.source, food.off_id ?? null, food.image_url ?? null, food.preparation ?? 'cooked',
         food.default_unit ?? null, food.unit_weight_grams ?? null, food.search_aliases ?? null]
      );
    } catch {
      // Fallback: default_unit/unit_weight_grams/search_aliases may not exist either
      result = await pool.query(
        `INSERT INTO foods (name, name_he, calories, protein, carbs, fat, is_liquid, barcode, source, off_id, image_url, preparation)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (off_id) WHERE off_id IS NOT NULL DO UPDATE SET
           name = EXCLUDED.name, calories = EXCLUDED.calories, protein = EXCLUDED.protein,
           carbs = EXCLUDED.carbs, fat = EXCLUDED.fat, is_liquid = EXCLUDED.is_liquid, image_url = EXCLUDED.image_url
         RETURNING id, name, calories, protein, carbs, fat, is_liquid, serving_sizes_ml, preparation, barcode, image_url`,
        [food.name, food.name_he ?? null, food.calories, food.protein, food.carbs, food.fat,
         food.is_liquid, food.barcode ?? null, food.source, food.off_id ?? null, food.image_url ?? null, food.preparation ?? 'cooked']
      );
    }
  }
  const row = result.rows[0];
  return { ...rowToResult(row), barcode: row.barcode as string | null, imageUrl: row.image_url as string | null };
}
