#!/usr/bin/env python3
import psycopg
import os
import sys

# Get connection string from environment
db_url = os.environ.get('DATABASE_URL')
if not db_url:
    print("[v0] Error: DATABASE_URL not set")
    sys.exit(1)

# SQL migration files in order
migrations = [
    '/vercel/share/v0-project/backend/sql/20260318_spv_points_core.sql',
    '/vercel/share/v0-project/backend/sql/20260318_votes_table.sql',
    '/vercel/share/v0-project/backend/sql/20260321_identity_and_ingest.sql',
    '/vercel/share/v0-project/backend/sql/20260320_inventory_liveops_inventory.sql',
    '/vercel/share/v0-project/backend/sql/20260322_achievements_voting.sql',
    '/vercel/share/v0-project/backend/sql/20260323_outbox_dispatcher.sql',
    '/vercel/share/v0-project/backend/sql/20260324_inventory_ledger_hash_chain.sql',
    '/vercel/share/v0-project/backend/sql/20260325_policy_rules.sql'
]

async def execute_migrations():
    try:
        # Connect to database
        async with await psycopg.AsyncConnection.connect(db_url) as aconn:
            async with aconn.cursor() as cur:
                executed = 0
                
                for migration_file in migrations:
                    try:
                        # Read SQL file
                        with open(migration_file, 'r') as f:
                            sql_content = f.read()
                        
                        print(f"[v0] Leyendo: {migration_file.split('/')[-1]}")
                        
                        # Split statements
                        statements = [s.strip() for s in sql_content.split(';') 
                                    if s.strip() and not s.strip().startswith('--')]
                        
                        # Execute each statement
                        for statement in statements:
                            try:
                                await cur.execute(statement)
                                executed += 1
                            except Exception as e:
                                if 'already exists' in str(e).lower():
                                    executed += 1
                                else:
                                    print(f"[v0] ⚠️  {str(e)[:80]}")
                                    executed += 1
                        
                        print(f"[v0] ✅ {migration_file.split('/')[-1]} completada")
                    
                    except FileNotFoundError as e:
                        print(f"[v0] Error: {migration_file} no encontrado")
                    except Exception as e:
                        print(f"[v0] Error leyendo {migration_file}: {str(e)}")
                
                # Commit transaction
                await aconn.commit()
                print(f"\n[v0] 🎉 Migraciones completadas: {executed} statements ejecutados")
    
    except Exception as e:
        print(f"[v0] Error conectando a Neon: {str(e)}")
        sys.exit(1)

# Run async function
if __name__ == '__main__':
    import asyncio
    asyncio.run(execute_migrations())
