import { Config } from "effect";

// The server's environment. Browser code reads only VITE_ variables, through import.meta.env.
export const databaseUrl = Config.Redacted("DATABASE_URL");

export const authConfig = Config.all({
  // The app's origin: http://localhost:3000, the production URL, or the previews' wildcard.
  siteUrl: Config.String("SITE_URL"),
  secret: Config.Redacted("BETTER_AUTH_SECRET"),
  // Dev and previews only: the seeded accounts sign in with this code.
  testOtpCode: Config.option(Config.NonEmptyString("TEST_OTP_CODE")),
  resendApiKey: Config.option(Config.Redacted("RESEND_API_KEY")),
  emailFrom: Config.option(Config.NonEmptyString("EMAIL_FROM")),
});
