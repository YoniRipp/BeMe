#!/usr/bin/env node
/**
 * Generates migrations/data/exercises-catalog.json from free-exercise-db.
 *
 * Source: https://github.com/yuhonas/free-exercise-db (Unlicense / public domain)
 * ~873 exercises, every one with photos, including 170 barbell and 81 cable movements.
 *
 * The output is committed to the repo so the migration stays deterministic and works
 * offline -- migrations must never depend on network access at run time.
 *
 * Usage:
 *   node scripts/build-exercise-catalog.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
/** jsDelivr mirrors the same repo and is a purpose-built CDN, unlike raw.githubusercontent. */
const IMAGE_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations/data');
const OUT_FILE = path.join(OUT_DIR, 'exercises-catalog.json');

/**
 * free-exercise-db equipment -> the vocabulary already used by this app's `category`
 * column (see migration 1773300000000_create-exercises-catalog).
 */
const EQUIPMENT_MAP = {
  'barbell': 'barbell',
  'dumbbell': 'dumbbell',
  'cable': 'cable',
  'machine': 'machine',
  'body only': 'bodyweight',
  'kettlebells': 'kettlebell',
  'e-z curl bar': 'barbell',
  'bands': 'bands',
  'medicine ball': 'other',
  'exercise ball': 'other',
  'foam roll': 'other',
  'other': 'other',
};

/** free-exercise-db granular muscles -> this app's coarse muscle_group buckets. */
const MUSCLE_MAP = {
  quadriceps: 'legs',
  hamstrings: 'legs',
  calves: 'legs',
  glutes: 'legs',
  adductors: 'legs',
  abductors: 'legs',
  abdominals: 'core',
  chest: 'chest',
  shoulders: 'shoulders',
  traps: 'shoulders',
  triceps: 'arms',
  biceps: 'arms',
  forearms: 'arms',
  lats: 'back',
  'middle back': 'back',
  'lower back': 'back',
  neck: 'full_body',
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    import('node:https').then(({ default: https }) => {
      https
        .get(url, (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`GET ${url} -> HTTP ${res.statusCode}`));
            res.resume();
            return;
          }
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          });
        })
        .on('error', reject);
    }, reject);
  });
}

function normalize(raw) {
  // A null `equipment` in the source means the movement needs none at all -- 77 records,
  // almost all stretching/plyometrics -- so they belong in the bodyweight bucket.
  const equipment = raw.equipment ? (EQUIPMENT_MAP[raw.equipment] ?? 'other') : 'bodyweight';
  const primary = raw.primaryMuscles ?? [];
  const muscleGroup = MUSCLE_MAP[primary[0]] ?? 'full_body';
  const images = (raw.images ?? []).map((img) => `${IMAGE_BASE}/${img}`);

  return {
    name: raw.name.trim(),
    muscleGroup,
    // `category` stays equipment-valued to match the 117 curated rows already in the table.
    category: equipment,
    equipment,
    discipline: raw.category ?? null,
    level: raw.level ?? null,
    mechanic: raw.mechanic ?? null,
    force: raw.force ?? null,
    primaryMuscles: primary,
    secondaryMuscles: raw.secondaryMuscles ?? [],
    instructions: raw.instructions ?? [],
    imageUrl: images[0] ?? null,
    imageUrl2: images[1] ?? null,
  };
}

async function main() {
  console.log(`Fetching ${SOURCE_URL} ...`);
  const source = await fetchJson(SOURCE_URL);
  console.log(`  ${source.length} exercises received`);

  const seen = new Set();
  const exercises = [];
  for (const raw of source) {
    if (!raw?.name) continue;
    // The table has a UNIQUE constraint on name; drop any duplicates up front so the
    // bulk insert can't fail on a self-conflict.
    const key = raw.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    exercises.push(normalize(raw));
  }

  exercises.sort((a, b) => a.name.localeCompare(b.name));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, `${JSON.stringify(exercises, null, 0)}\n`, 'utf8');

  const tally = (key) =>
    Object.entries(
      exercises.reduce((acc, ex) => {
        const v = ex[key] ?? 'none';
        acc[v] = (acc[v] || 0) + 1;
        return acc;
      }, {}),
    ).sort((a, b) => b[1] - a[1]);

  console.log(`\nWrote ${exercises.length} exercises -> ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`  (${(fs.statSync(OUT_FILE).size / 1024).toFixed(0)} KB)`);
  console.log('\nBy equipment:');
  for (const [k, v] of tally('equipment')) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log('\nBy muscle group:');
  for (const [k, v] of tally('muscleGroup')) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log(`\nWith images: ${exercises.filter((e) => e.imageUrl).length}/${exercises.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
