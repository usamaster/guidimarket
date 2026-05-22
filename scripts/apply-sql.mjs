import { readFileSync } from 'node:fs'
import pg from 'pg'

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error('Set DATABASE_URL in .env.')
    process.exit(1)
  }
  const path = process.argv[2]
  if (!path) {
    console.error('Usage: node scripts/apply-sql.mjs <path-to-sql>')
    process.exit(1)
  }
  const sql = readFileSync(path, 'utf8')
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    await client.query(sql)
    console.log(`Applied ${path}.`)
  } catch (e) {
    console.error(e)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
