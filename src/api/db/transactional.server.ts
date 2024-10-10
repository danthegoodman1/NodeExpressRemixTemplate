import { Database } from "sqlite"
import { pool } from "./db.server.js"

export default async function inTransaction<T>(
  fn: (conn: Database) => Promise<T>
): Promise<void> {
  const conn = await pool.acquire()
  try {
    await conn.run("BEGIN IMMEDIATE")
    await fn(conn)
    await conn.run("COMMIT")
  } catch (e) {
    await conn.run("ROLLBACK")
    throw e
  } finally {
    await pool.release(conn)
  }
}
