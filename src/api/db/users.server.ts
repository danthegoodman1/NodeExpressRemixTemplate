import { logger } from "../logger/index.js"
import { pool } from "./db.server.js"
import { UserRow } from "./types.js"
import { extractError } from "../utils.js"
import { RowsNotFound } from "./errors.js"
import { randomUUID } from "crypto"

export async function createOrGetUser(
  email: string,
  refreshToken?: string
): Promise<UserRow> {
  const conn = await pool.acquire()
  try {
    let user = await conn.get<UserRow>(
      `
    select *
    from users
    where email = ?
  `,
      email
    )
    if (!user) {
      // Create it
      const id = randomUUID()
      user = await conn.get<UserRow>(
        `insert into users (id, email, created_ms, refresh_token) values (?, ?, ?, ?) returning *`,
        id,
        email,
        new Date().getTime(),
        refreshToken
      )
    }

    return user!
  } catch (error) {
    logger.error(
      {
        err: extractError(error),
      },
      "error in createOrGetUser"
    )
    throw error
  } finally {
    await pool.release(conn)
  }
}

export async function selectUser(id: string): Promise<UserRow> {
  const conn = await pool.acquire()
  try {
    const user = await conn.get<UserRow>(
      `
    select *
    from users
    where id = ?
    `,
      id
    )
    if (!user) {
      throw new RowsNotFound()
    }
    return user
  } finally {
    await pool.release(conn)
  }
}

export async function updateUserRefreshToken(id: string, refreshToken: string) {
  const conn = await pool.acquire()
  try {
    await conn.run(
      `
    update users
    set refresh_token = ?
    where id = ?
  `,
      refreshToken,
      id
    )
  } finally {
    await pool.release(conn)
  }
}
