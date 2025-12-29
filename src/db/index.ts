/**
 * Database module for Phase 2
 * Wraps Supabase client for direct SQL queries when needed
 */

import { supabase } from '../lib/supabase';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

/**
 * Execute a raw SQL query via Supabase RPC
 * For complex queries not supported by the query builder
 */
export async function query<T = any>(
  sql: string,
  params: any[] = []
): Promise<QueryResult<T>> {
  // For most operations, use Supabase's query builder instead
  // This is a fallback for complex queries
  const { data, error } = await supabase.rpc('execute_sql', {
    query: sql,
    params: params
  });

  if (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }

  return {
    rows: data || [],
    rowCount: data?.length || 0
  };
}

/**
 * Get Supabase client for query builder operations
 */
export function getClient() {
  return supabase;
}

export { supabase };
