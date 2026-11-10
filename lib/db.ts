import { Pool, type PoolClient } from "pg";
import { AppError } from "./errors";

let pool: Pool | undefined;

export function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new AppError(503, "数据库尚未配置。请联系站点管理员。 ");
  if (!pool) pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 20_000 });
  return pool;
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
