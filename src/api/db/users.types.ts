import { z } from "zod"

/**
 * Emails are the primary mechanism for identifying users, but they also have unique IDs
 * so that we can relate information without using PII.
 */

export const UserRow = z.object({
  id: z.string(),
  /**
   * This is a slug that can be used to identify the user in a URL
   */
  email: z.string().email(),
  name: z.string(),
  scopes: z.string(),
  created_ms: z.string(),
  platform: z.enum(["twitch", "youtube"]),
})

export type UserRow = z.infer<typeof UserRow>
