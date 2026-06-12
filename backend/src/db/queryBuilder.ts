/**
 * Typed query builder for dynamic UPDATE statements.
 * Eliminates the duplicated update pattern across models.
 */

type QueryParam = string | number | boolean | null;

interface ColumnMapping<T> {
  /** Map from camelCase input key to snake_case column name */
  column: string;
  /** Optional type cast suffix (e.g. '::date', '::jsonb') */
  cast?: string;
  /** Optional transform before inserting as parameter */
  transform?: (value: NonNullable<T>) => QueryParam;
}

export interface UpdateBuilder<TInput> {
  columns: { [K in keyof TInput]?: ColumnMapping<TInput[K]> };
}

/**
 * Build a dynamic UPDATE. Pass ownerColumn/ownerId as null for global
 * (non-user-scoped) tables; extraSetClauses appends raw, parameter-free
 * assignments such as 'updated_at = now()'.
 */
export function buildUpdateQuery<TInput>(
  table: string,
  idColumn: string,
  ownerColumn: string | null,
  returning: string,
  spec: UpdateBuilder<TInput>,
  updates: Partial<TInput>,
  id: string,
  ownerId: string | null,
  extraSetClauses: string[] = [],
): { sql: string; params: QueryParam[] } | null {
  const setClauses: string[] = [];
  const params: QueryParam[] = [];
  let paramIdx = 1;

  for (const [key, mapping] of Object.entries(spec.columns) as [string, ColumnMapping<unknown>][]) {
    const value = (updates as Record<string, unknown>)[key];
    if (value === undefined) continue;

    const cast = mapping.cast ?? '';
    setClauses.push(`${mapping.column} = $${paramIdx}${cast}`);

    if (mapping.transform && value != null) {
      params.push(mapping.transform(value));
    } else {
      params.push(value as QueryParam);
    }
    paramIdx++;
  }

  if (setClauses.length === 0) return null;
  setClauses.push(...extraSetClauses);

  params.push(id as QueryParam);
  let where = `${idColumn} = $${paramIdx}`;
  if (ownerColumn != null) {
    params.push(ownerId as QueryParam);
    where += ` AND ${ownerColumn} = $${paramIdx + 1}`;
  }

  return { sql: `UPDATE ${table} SET ${setClauses.join(', ')} WHERE ${where} RETURNING ${returning}`, params };
}
