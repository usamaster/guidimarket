import { readFileSync } from 'node:fs'
import pg from 'pg'

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('Set DATABASE_URL in .env (Supabase → Settings → Database → Connection string).')
    process.exit(1)
  }
  const sql = readFileSync(new URL('../supabase/worldcup_schema.sql', import.meta.url), 'utf8')
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(sql)
    console.log('Schema applied.')
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
