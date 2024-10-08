import express from "express"
import { v4 as uuidv4 } from "uuid"
import cors from "cors"
import { statfs } from "fs/promises"
import { ZodError } from "zod"

import { logger } from "./logger/index.js"
import { createRequestHandler } from "@remix-run/express"
import { broadcastDevReady } from "@remix-run/node"

import sourceMapSupport from "source-map-support"
sourceMapSupport.install()

const build = await import(process.env.NODE_ENV === "production" ? "../build/index.js" : "../../build/index.js") // tsc will try to import this
import { extractError } from "./utils.js"

const listenPort = process.env.PORT || "8080"

declare global {
  namespace Express {
    interface Request {
      id: string
    }
  }

  namespace NodeJS {
    interface ProcessEnv {
      DB_FILENAME?: string
      ADMIN_EMAILS?: string
      AWS_DEFAULT_REGION?: string
      AWS_ACCESS_KEY_ID?: string
      AWS_SECRET_ACCESS_KEY?: string
      S3_BUCKET: string
      S3_ENDPOINT: string
      POSTMARK_TOKEN: string
      MY_URL: string

      AXIOM_ORG_ID: string
      AXIOM_TOKEN: string
      AXIOM_DATASET: string
    }
  }
}

const diskCheckLoop = setInterval(async () => {
  const stats = await statfs(process.env.DISK_PATH || "/")
  const totalSpace = stats.bsize * stats.blocks
  const availableSpace = stats.bsize * stats.bfree
  if (availableSpace < totalSpace * 0.15) {
    // When 15% space left, notify
    logger.error("less less than 15% disk space remaining!")
  }
}, 30_000)

process.on("unhandledRejection", (reason: any, p: Promise<any>) => {
  logger.error(
    {
      err: reason instanceof Error ? extractError(reason) : reason,
    },
    "unhandled promise rejection"
  )
})

async function main() {
  const app = express()
  app.use(express.json())
  app.disable("x-powered-by")
  app.use(cors())

  // Remix public
  app.use(express.static("public"))
  app.use(express.static("src/public"))

  app.use((req, res, next) => {
    const reqID = uuidv4()
    req.id = reqID
    next()
  })

  if (process.env.HTTP_LOG === "1") {
    logger.debug("using HTTP logger")
    app.use((req: any, res, next) => {
      req.log.info({ req })
      res.on("finish", () => req.log.info({ res }))
      next()
    })
  }

  app.get("/hc", (req, res) => {
    res.sendStatus(200)
  })

  // Everything else we send to the frontend
  app.all("*", createRequestHandler({ build: build as any, mode: process.env.NODE_ENV }))

  // Error handler
  app.use((err: any, req: any, res: any, next: any) => {
    if (err instanceof ZodError) {
      return res.status(400).send(`Invalid body: ${err.message}`)
    }

    logger.error({ err, id: req.id })
    res.status(500).send("Internal Server Error")
  })

  const server = app.listen(listenPort, () => {
    if (process.env.NODE_ENV === "development") {
      broadcastDevReady(build as any)
    }
    logger.info(`API listening on port ${listenPort}`)
  })

  const signals = {
    SIGHUP: 1,
    SIGINT: 2,
    SIGTERM: 15,
  }

  let stopping = false
  Object.keys(signals).forEach((signal) => {
    process.on(signal, async () => {
      if (stopping) {
        return
      }
      stopping = true
      clearInterval(diskCheckLoop)
      logger.info(`Received signal ${signal}, shutting down...`)
      logger.info("exiting...")
      logger.flush() // pino actually fails to flush, even with awaiting on a callback
      server.close()
      process.exit(0)
    })
  })
}

main()
