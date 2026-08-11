/**
 * Exercise catalog model — typed data access for the global (non-user-scoped) exercise catalog.
 */
import pg from 'pg';
import { getPool } from '../db/pool.js';
import { buildUpdateQuery, type UpdateBuilder } from '../db/queryBuilder.js';
import { escapeLike } from '../utils/escapeLike.js';

/**
 * Columns for browse/autocomplete. Deliberately excludes `instructions` — with ~900
 * exercises those step-by-step arrays dominate the payload, and only the detail view
 * needs them (see `findById`).
 */
const LIST_COLUMNS = `id, name, muscle_group, category, equipment, discipline, level,
  mechanic, force, primary_muscles, secondary_muscles, image_url, image_url_2, video_url`;

const DETAIL_COLUMNS = `${LIST_COLUMNS}, instructions`;

const RETURNING = `${DETAIL_COLUMNS}, created_at, updated_at`;

export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup: string | null;
  category: string | null;
  equipment?: string | null;
  discipline?: string | null;
  level?: string | null;
  mechanic?: string | null;
  force?: string | null;
  primaryMuscles?: string[] | null;
  secondaryMuscles?: string[] | null;
  imageUrl: string | null;
  imageUrl2?: string | null;
  videoUrl: string | null;
  /** Only populated by `findById` — omitted from list responses to keep them small. */
  instructions?: string[] | null;
}

export interface AdminCatalogExercise extends CatalogExercise {
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateExerciseInput {
  name: string;
  muscleGroup?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  createdBy: string;
}

export interface UpdateExerciseInput {
  name?: string;
  muscleGroup?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
}

export interface ExerciseListFilters {
  q?: string;
  muscleGroup?: string;
  equipment?: string;
  level?: string;
  discipline?: string;
  limit: number;
  offset: number;
}

function rowToExercise(row: Record<string, unknown>): CatalogExercise {
  const exercise: CatalogExercise = {
    id: row.id as string,
    name: row.name as string,
    muscleGroup: (row.muscle_group as string) ?? null,
    category: (row.category as string) ?? null,
    equipment: (row.equipment as string) ?? null,
    discipline: (row.discipline as string) ?? null,
    level: (row.level as string) ?? null,
    mechanic: (row.mechanic as string) ?? null,
    force: (row.force as string) ?? null,
    primaryMuscles: (row.primary_muscles as string[]) ?? null,
    secondaryMuscles: (row.secondary_muscles as string[]) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    imageUrl2: (row.image_url_2 as string) ?? null,
    videoUrl: (row.video_url as string) ?? null,
  };
  // Only present on detail/admin queries; keep it off list payloads entirely.
  if (row.instructions !== undefined) {
    exercise.instructions = (row.instructions as string[]) ?? null;
  }
  return exercise;
}

function rowToAdminExercise(row: Record<string, unknown>): AdminCatalogExercise {
  return {
    ...rowToExercise(row),
    createdAt: row.created_at as Date | string,
    updatedAt: row.updated_at as Date | string,
  };
}

export async function list(filters: ExerciseListFilters, client?: pg.Pool | pg.PoolClient): Promise<CatalogExercise[]> {
  const db = client ?? getPool();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${escapeLike(filters.q)}%`);
    conditions.push(`name ILIKE $${params.length}`);
  }
  if (filters.muscleGroup) {
    params.push(filters.muscleGroup);
    conditions.push(`muscle_group = $${params.length}`);
  }
  if (filters.equipment) {
    params.push(filters.equipment);
    conditions.push(`equipment = $${params.length}`);
  }
  if (filters.level) {
    params.push(filters.level);
    conditions.push(`level = $${params.length}`);
  }
  if (filters.discipline) {
    params.push(filters.discipline);
    conditions.push(`discipline = $${params.length}`);
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  params.push(filters.limit, filters.offset);
  const result = await db.query(
    `SELECT ${LIST_COLUMNS} FROM exercises${where} ORDER BY name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return result.rows.map(rowToExercise);
}

export async function findById(id: string, client?: pg.Pool | pg.PoolClient): Promise<CatalogExercise | null> {
  const db = client ?? getPool();
  const result = await db.query(`SELECT ${DETAIL_COLUMNS} FROM exercises WHERE id = $1`, [id]);
  return result.rows[0] ? rowToExercise(result.rows[0]) : null;
}

export async function listAdmin(pagination: { limit: number; offset: number }, client?: pg.Pool | pg.PoolClient): Promise<AdminCatalogExercise[]> {
  const db = client ?? getPool();
  const result = await db.query(
    `SELECT ${RETURNING} FROM exercises ORDER BY name ASC LIMIT $1 OFFSET $2`,
    [pagination.limit, pagination.offset],
  );
  return result.rows.map(rowToAdminExercise);
}

/** Insert by unique name; on conflict, fill in any newly provided fields (admin upsert semantics). */
export async function upsert(input: CreateExerciseInput, client?: pg.Pool | pg.PoolClient): Promise<AdminCatalogExercise> {
  const db = client ?? getPool();
  const result = await db.query(
    `INSERT INTO exercises (name, muscle_group, category, image_url, video_url, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (name) DO UPDATE SET
       muscle_group = COALESCE(EXCLUDED.muscle_group, exercises.muscle_group),
       category = COALESCE(EXCLUDED.category, exercises.category),
       image_url = COALESCE(EXCLUDED.image_url, exercises.image_url),
       video_url = COALESCE(EXCLUDED.video_url, exercises.video_url),
       updated_at = now()
     RETURNING ${RETURNING}`,
    [input.name.trim(), input.muscleGroup || null, input.category || null, input.imageUrl || null, input.videoUrl || null, input.createdBy],
  );
  return rowToAdminExercise(result.rows[0]);
}

/** Empty strings clear optional fields (stored as NULL); name is required and never cleared. */
const clearable = (v: string) => v || null;

const UPDATE_SPEC: UpdateBuilder<UpdateExerciseInput> = {
  columns: {
    name: { column: 'name' },
    muscleGroup: { column: 'muscle_group', transform: clearable },
    category: { column: 'category', transform: clearable },
    imageUrl: { column: 'image_url', transform: clearable },
    videoUrl: { column: 'video_url', transform: clearable },
  },
};

export async function update(id: string, updates: UpdateExerciseInput, client?: pg.Pool | pg.PoolClient): Promise<AdminCatalogExercise | null> {
  const db = client ?? getPool();
  const query = buildUpdateQuery('exercises', 'id', null, RETURNING, UPDATE_SPEC, updates, id, null, ['updated_at = now()']);
  if (!query) return null;
  const result = await db.query(query.sql, query.params);
  return result.rows[0] ? rowToAdminExercise(result.rows[0]) : null;
}

export async function deleteById(id: string, client?: pg.Pool | pg.PoolClient): Promise<boolean> {
  const db = client ?? getPool();
  const result = await db.query('DELETE FROM exercises WHERE id = $1 RETURNING id', [id]);
  return (result.rowCount ?? 0) > 0;
}
