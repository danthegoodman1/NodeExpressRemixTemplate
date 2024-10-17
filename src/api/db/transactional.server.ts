import { Database } from "sqlite"
import { pool } from "./db.server.js"

export async function inTransaction(
  fn: (conn: Database) => Promise<any>
): Promise<void> {
  const conn = await pool.acquire()
  try {
    await conn.exec("BEGIN IMMEDIATE")
    await fn(conn)
    await conn.exec("COMMIT")
  } catch (e) {
    await conn.exec("ROLLBACK")
    throw e
  } finally {
    await pool.release(conn)
  }
}

export async function withConn(
  fn: (conn: Database) => Promise<any>
): Promise<void> {
  const conn = await pool.acquire()
  try {
    await fn(conn)
  } catch (e) {
    throw e
  } finally {
    await pool.release(conn)
  }
}
