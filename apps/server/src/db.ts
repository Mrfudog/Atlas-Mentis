import { Pool } from 'pg';
import { loadConfig } from './config.js';

let pool: Pool | undefined;

export function getPool(): Pool {
  pool ??= new Pool({ connectionString: loadConfig().databaseUrl });
  return pool;
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}
