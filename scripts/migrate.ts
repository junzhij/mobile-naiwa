import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  try {
    await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const filename of (await readdir(join(process.cwd(), "db"))).filter((name) => name.endsWith(".sql")).sort()) {
      const already = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
      if (already.rowCount) continue;
      const sql = await readFile(join(process.cwd(), "db", filename), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
        await client.query("COMMIT");
        console.log(`Applied ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
