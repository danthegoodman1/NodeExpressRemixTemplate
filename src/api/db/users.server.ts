import { logger } from "../logger/index.js"
import { extractError } from "../utils.js"
import { RowsNotFound } from "./errors.js"
import { randomUUID } from "crypto"
import { UserRow } from "./users.types.js"
import { Database } from "sqlite"

export async function createOrGetUser(
  conn: Database,
  email: string
): Promise<UserRow> {
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
        `insert into users (id, email, created_ms) values (?, ?, ?) returning *`,
        id,
        email,
        new Date().getTime()
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
  }
}

export async function selectUser(conn: Database, id: string): Promise<UserRow> {
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
}
