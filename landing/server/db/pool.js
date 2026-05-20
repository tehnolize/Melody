import pg from 'pg';

const { Pool } = pg;

/**
 * Создаёт пул соединений с PostgreSQL
 * @param {string} connectionString
 * @returns {import('pg').Pool}
 */
export function createPool(connectionString) {
  return new Pool({ connectionString });
}
