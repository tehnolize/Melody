import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { createPool } from './pool.js';

export { createPool };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Инициализирует схему базы данных из schema.sql
 * @param {import('pg').Pool} pool
 */
export async function initDb(pool) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = await readFile(schemaPath, 'utf-8');
  await pool.query(schema);
  console.log('[DB] Schema initialized successfully');
}
