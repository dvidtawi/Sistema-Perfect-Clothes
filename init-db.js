import 'dotenv/config';
import fs from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;

const targetDatabase = process.env.PGDATABASE || 'rosel_sis';
const maintenanceDb = process.env.PGMAINTENANCE_DB || 'postgres';

function baseConfig(database) {
  const pgVarsPresent =
    process.env.PGHOST ||
    process.env.PGPORT ||
    process.env.PGUSER ||
    process.env.PGPASSWORD ||
    process.env.PGDATABASE;

  if (!pgVarsPresent && process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL.replace(
        /\/[^/?#]+(\?.*)?$/,
        `/${database}$1`
      ),
    };
  }

  return {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database,
  };
}

async function ensureDatabase() {
  const client = new Client(baseConfig(maintenanceDb));
  await client.connect();
  try {
    const exists = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [targetDatabase]
    );
    if (!exists.rowCount) {
      await client.query(`CREATE DATABASE "${targetDatabase}"`);
      console.log(`Base de datos creada: ${targetDatabase}`);
    } else {
      console.log(`Base de datos ya existe: ${targetDatabase}`);
    }
  } finally {
    await client.end();
  }
}

async function applySchema() {
  const schema = await fs.readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  const client = new Client(baseConfig(targetDatabase));
  await client.connect();
  try {
    await client.query(schema);
    console.log('Esquema aplicado correctamente.');
  } finally {
    await client.end();
  }
}

try {
  await ensureDatabase();
  await applySchema();
  console.log('Inicializacion completada.');
} catch (error) {
  console.error('No se pudo inicializar la base de datos.');
  console.error(error.message);
  process.exit(1);
}
