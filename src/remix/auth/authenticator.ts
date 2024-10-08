import { createCookieSessionStorage, redirect } from "@remix-run/node"
import { Authenticator } from "remix-auth"
import { OAuth2Strategy } from "remix-auth-oauth2"
import { createOrGetUser, selectUser } from "../../api/db/users.server"
import { EmailLinkStrategy } from "remix-auth-email-link"

import { logger } from "../../api/logger"
import { extractError } from "../../api/utils"
import { isAdminEmail } from "../../api/utils.server"
import { sendEmail } from "./email.server"
import inTransaction from "../../api/db/transactional.server"
import { UserRow } from "../../api/db/users.types"
import { RowsNotFound } from "../../api/db/errors"

// export the whole sessionStorage object
export let sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "_session",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets: [process.env.COOKIE_SECRET!],
    secure: process.env.NODE_ENV === "production", // enable this in prod only
    maxAge: 3600 * 24 * 14, // 2 weeks
  },
})

export interface AuthSession {
  id: string
  email: string
  isAdmin: boolean
  subscription?: string
}

export let authenticator = new Authenticator<AuthSession>(sessionStorage)

export const emailStrategyAuthenticator = "email-link"

let secret = process.env.COOKIE_SECRET
if (!secret) throw new Error("Missing COOKIE_SECRET env variable.")

authenticator.use(
  new EmailLinkStrategy(
    { sendEmail, secret, callbackURL: "/magic" },
    // In the verify callback,
    // you will receive the email address, form data and whether or not this is being called after clicking on magic link
    // and you should return the user instance
    async ({
      email,
      form,
      magicLinkVerify,
    }: {
      email: string
      form: FormData
      magicLinkVerify: boolean
    }) => {
      try {
        logger.debug(
          {
            email,
          },
          "got user"
        )

        let user: UserRow | undefined
        await inTransaction(async (conn) => {
          user = await createOrGetUser(
            conn,
            email
          )
        })

        // pleasing typescript
        if (!user)
          throw new Error("User not created or found THIS SHOULD NOT HAPPEN")

        return {
          ...user,
          isAdmin: isAdminEmail(user.email),
        }
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
  ),
  // this is optional, but if you setup more than one OAuth2 instance you will
  // need to set a custom name to each one
  emailStrategyAuthenticator
)

export interface authedUser extends UserRow {
  authSession: AuthSession
}

export async function getAuthedUser(
  request: Request
): Promise<authedUser | null> {
  const user = await authenticator.isAuthenticated(request)
  if (!user) {
    return null
  }

  try {
    let userInfo: UserRow | undefined
    await inTransaction(async (conn) => {
      userInfo = await selectUser(conn, user.id)
    })

    // Pleasing TypeScript
    if (!userInfo) {
      throw new RowsNotFound()
    }

    return {
      ...userInfo,
      authSession: user,
    }
  } catch (error) {
    if (error instanceof RowsNotFound) {
      throw redirect("/signout")
    }
    throw error
  }
}
