import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const sqlPath = path.join(root, 'supabase', 'news_queue_full.sql')

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('Set DATABASE_URL or SUPABASE_DB_URL (e.g. in .env). Run: node --env-file=.env scripts/apply-news-queue-sql.mjs')
  process.exit(1)
}

const full = fs.readFileSync(sqlPath, 'utf8')
const splitAt = full.indexOf('\nUPDATE news_items AS n')
if (splitAt === -1) {
  console.error('news_queue_full.sql: expected UPDATE block')
  process.exit(1)
}
const schemaSql = full.slice(0, splitAt).trim()
const resetSql = full.slice(splitAt + 1).trim()

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
})
await client.connect()
try {
  await client.query(schemaSql)
  await client.query(resetSql)
  const { rows } = await client.query(`
    SELECT
      count(*) FILTER (WHERE published)::int AS published,
      count(*) FILTER (WHERE NOT published)::int AS queued,
      count(*)::int AS total
    FROM news_items
  `)
  console.log('Done. news_items:', rows[0])
} finally {
  await client.end()
}
