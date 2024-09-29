import genericPool from "generic-pool"
import sqlite from "sqlite3"
import { open } from "sqlite"

import { readFile } from "fs/promises"
import path from "path"
import { logger } from "../logger/index.js"

const dbFileName = process.env.DB_FILENAME ?? "sqlite.db"

export const pool = genericPool.createPool(
  {
    create: async () => {
      const db = await open({
        filename: dbFileName,
        driver: sqlite.Database,
      })
      await db.exec("PRAGMA journal_mode = WAL;")
      await db.exec("PRAGMA busy_timeout = 5000;")
      await db.exec("PRAGMA synchronous = NORMAL;") // WAL permits relaxing this
      logger.debug(`Using db file "${dbFileName}"`)
      const schema = await readFile(
        path.join("src", "api", "db", "schema.sql"),
        "utf-8"
      )
      logger.debug(`Running schema.sql`)
      schema
        .split(";")
        .filter((stmt) => stmt.trim() !== "")
        .map((stmt) => {
          db.exec(stmt.trim())
        })
      logger.debug("Loaded schema")
      return db
    },
    destroy: async (db) => {
      await db.close()
    },
  },
  { max: 5, min: 1 }
)

// export async function prepareStatement(stmt: string): Promise<Statement> {
//   try {
//     return db.query(stmt)
//   } catch (error) {
//     if ((error as Error).message.includes("no such table")) {
//       await initDB()
//       return db.query(stmt)
//     }
//     throw error
//   }
// }
