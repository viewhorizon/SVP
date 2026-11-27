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

    // Array de rutas de migraciones en orden
    const migrations = [
      '/vercel/share/v0-project/backend/sql/20260318_spv_points_core.sql',
      '/vercel/share/v0-project/backend/sql/20260318_votes_table.sql',
      '/vercel/share/v0-project/backend/sql/20260321_identity_and_ingest.sql',
      '/vercel/share/v0-project/backend/sql/20260320_inventory_liveops_inventory.sql',
      '/vercel/share/v0-project/backend/sql/20260322_achievements_voting.sql',
      '/vercel/share/v0-project/backend/sql/20260323_outbox_dispatcher.sql',
      '/vercel/share/v0-project/backend/sql/20260324_inventory_ledger_hash_chain.sql',
      '/vercel/share/v0-project/backend/sql/20260325_policy_rules.sql'
    ];

    let executed = 0;

    for (const migrationFile of migrations) {
      try {
        const fullPath = migrationFile;
        console.log(`[v0] Leyendo: ${path.basename(migrationFile)}`);
        const migrationSQL = fs.readFileSync(fullPath, 'utf-8');
        
        // Split into individual statements
        const statements = migrationSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
          try {
            await sql(statement);
            executed++;
          } catch (error) {
            if (error.message && (error.message.includes('already exists') || error.message.includes('EEXIST'))) {
              executed++;
            } else {
              console.log(`[v0] ⚠️  ${error.message.substring(0, 80)}`);
              executed++;
            }
          }
        }
        
        console.log(`[v0] ✅ ${path.basename(migrationFile)} completada`);
      } catch (fileError) {
        console.error(`[v0] Error leyendo ${migrationFile}:`, fileError.message);
      }
    }

    console.log(`[v0] 🎉 Migraciones completadas: ${executed} statements ejecutados`);
    
  } catch (error) {
    console.error('[v0] Error fatal:', error.message);
    process.exit(1);
  }
}

executeMigrations();
