/**
 * Shared Google Generative AI client — singletons to avoid re-instantiating
 * the SDK client and model wrappers on every call.
 *
 * Previously `new GoogleGenerativeAI()` + `getGenerativeModel()` ran on every
 * voice parse / food lookup / embedding. Both are stateless per request (the
 * payload is passed to generateContent/embedContent), so they are safe to cache.
 */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, type GenerativeModel, type ModelParams } from '@google/generative-ai';
import { config } from '../config/index.js';

/** All harm categories disabled — food phrases ("bloody steak") must not be blocked. */
export const SAFETY_BLOCK_NONE = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
  if (!genAI) genAI = new GoogleGenerativeAI(config.geminiApiKey);
  return genAI;
}

const modelCache = new Map<string, GenerativeModel>();

/**
 * Return a cached GenerativeModel for the given params. Cache key is the model
 * name plus a caller-supplied suffix so variants (e.g. with a systemInstruction)
 * don't collide. Pass a stable `cacheKey` whenever `params` includes a
 * systemInstruction or other non-default options.
 */
export function getModel(params: ModelParams, cacheKey?: string): GenerativeModel {
  const key = cacheKey ? `${params.model}::${cacheKey}` : params.model;
  let model = modelCache.get(key);
  if (!model) {
    model = getGenAI().getGenerativeModel(params);
    modelCache.set(key, model);
  }
  return model;
}
