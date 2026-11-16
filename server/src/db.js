import dotenv from 'dotenv';
dotenv.config();

let query;
let pool = null;

if (process.env.DATABASE_URL) {
  const pg = (await import('pg')).default;
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost')
      ? false
      : { rejectUnauthorized: false }, // requerido por Neon/Supabase
  });
  query = (text, params) => pool.query(text, params);
  console.log('[db] Postgres nube/local');
} else {
  // Modo demo localhost sin Postgres: memoria (pg-mem, mismo SQL)
  const { newDb } = await import('pg-mem');
  const db = newDb();
  const { Pool: MemPool } = db.adapters.createPg();
  pool = new MemPool();
  query = (text, params) => pool.query(text, params);
  console.log('[db] Memoria local (demo localhost, sin nube)');
}

export { pool, query };
