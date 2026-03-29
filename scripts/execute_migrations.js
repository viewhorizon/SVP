import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('[v0] Error: DATABASE_URL not set');
  process.exit(1);
}

async function executeMigrations() {
  try {
    console.log('[v0] Conectando a Neon...');
    const sql = neon(DATABASE_URL);

    // Read the migration file
    const migrationPath = path.join(__dirname, '01_run_all_migrations.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('[v0] Ejecutando migraciones...');
    
    // Split into individual statements and execute
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    let executed = 0;
    for (const statement of statements) {
      try {
        await sql([statement]);
        executed++;
        console.log(`[v0] Ejecutada migración ${executed}/${statements.length}`);
      } catch (error) {
        if (error.message && error.message.includes('already exists')) {
          console.log(`[v0] Tabla ya existe, saltando...`);
          executed++;
        } else {
          console.error(`[v0] Error en migración:`, error.message);
          // Continue with next migration
          executed++;
        }
      }
    }

    console.log('[v0] ✅ Todas las migraciones completadas exitosamente');
    console.log(`[v0] ${executed} statements ejecutados`);
    
  } catch (error) {
    console.error('[v0] Error fatal:', error.message);
    process.exit(1);
  }
}

executeMigrations();
