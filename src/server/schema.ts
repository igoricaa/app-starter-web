import { bigint, boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { Schema } from "effect";

// Better Auth's tables, as `bunx auth generate` writes them (without the relations). The display
// name is Better Auth's `user.name`.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// One row per sign-in code request or code check let through, for the limits in auth.ts.
export const otpAttempt = pgTable(
  "otp_attempt",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    kind: text("kind", { enum: ["send", "verify"] }).notNull(),
    email: text("email").notNull(),
    // A code requested for an address with no account yet; only these count toward the global cap.
    newAddress: boolean("new_address").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  // The per-address counts filter on email and a time window; the cleanup on created_at alone.
  (table) => [
    index("otp_attempt_email_created_at_idx").on(table.email, table.createdAt),
    index("otp_attempt_created_at_idx").on(table.createdAt),
  ],
);

// `user.name`, trimmed. Better Auth creates accounts without this check, so auth.ts applies it too.
export const DisplayName = Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(50));
