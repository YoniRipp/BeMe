/**
 * Exercise catalog model — typed data access for the global (non-user-scoped) exercise catalog.
 */
import pg from 'pg';
import { getPool } from '../db/pool.js';
import { escapeLike } from '../utils/escapeLike.js';

const RETURNING = 'id, name, muscle_group, category, image_url, video_url, created_at, updated_at';

export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup: string | null;
  category: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
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
  limit: number;
  offset: number;
}

function rowToExercise(row: Record<string, unknown>): CatalogExercise {
  return {
    id: row.id as string,
    name: row.name as string,
    muscleGroup: (row.muscle_group as string) ?? null,
    category: (row.category as string) ?? null,
    imageUrl: (row.image_url as string) ?? null,
    videoUrl: (row.video_url as string) ?? null,
  };
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

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
  params.push(filters.limit, filters.offset);
  const result = await db.query(
    `SELECT ${RETURNING} FROM exercises${where} ORDER BY name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return result.rows.map(rowToExercise);
}

export async function findById(id: string, client?: pg.Pool | pg.PoolClient): Promise<CatalogExercise | null> {
  const db = client ?? getPool();
  const result = await db.query(`SELECT ${RETURNING} FROM exercises WHERE id = $1`, [id]);
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

const UPDATE_COLUMNS: Record<keyof UpdateExerciseInput, string> = {
  name: 'name',
  muscleGroup: 'muscle_group',
  category: 'category',
  imageUrl: 'image_url',
  videoUrl: 'video_url',
};

export async function update(id: string, updates: UpdateExerciseInput, client?: pg.Pool | pg.PoolClient): Promise<AdminCatalogExercise | null> {
  const db = client ?? getPool();
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, column] of Object.entries(UPDATE_COLUMNS) as [keyof UpdateExerciseInput, string][]) {
    const value = updates[key];
    if (value === undefined) continue;
    // Empty strings clear optional fields (stored as NULL); name is required and never cleared.
    params.push(key === 'name' ? value : value || null);
    sets.push(`${column} = $${params.length}`);
  }
  if (sets.length === 0) return null;

  sets.push('updated_at = now()');
  params.push(id);
  const result = await db.query(
    `UPDATE exercises SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${RETURNING}`,
    params,
  );
  return result.rows[0] ? rowToAdminExercise(result.rows[0]) : null;
}

export async function deleteById(id: string, client?: pg.Pool | pg.PoolClient): Promise<boolean> {
  const db = client ?? getPool();
  const result = await db.query('DELETE FROM exercises WHERE id = $1 RETURNING id', [id]);
  return (result.rowCount ?? 0) > 0;
}
