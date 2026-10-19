DROP INDEX "otp_attempt_email_idx";--> statement-breakpoint
CREATE INDEX "otp_attempt_email_created_at_idx" ON "otp_attempt" ("email","created_at");