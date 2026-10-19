import { assert, describe, it } from "vitest";
import { refusal } from "./guard";

const production = "ep-prod-123.c-2.eu-central-1.aws.neon.tech";
const preview = "ep-preview-456.c-2.eu-central-1.aws.neon.tech";
const pooled = (host: string) => host.replace(/^([^.]+)/, "$1-pooler");
const url = (host: string, query = "") => `postgresql://user:password@${host}/neondb${query}`;
const previewEnv = (databaseUrl: string) => ({
  VERCEL_ENV: "preview",
  PRODUCTION_DATABASE_HOST: production,
  DATABASE_URL: databaseUrl,
  DATABASE_URL_UNPOOLED: url(preview),
});

describe("the build guard", () => {
  it("refuses a preview whose effective host is production's", () => {
    for (const databaseUrl of [
      url(pooled(production)),
      url(pooled(preview), `?host=${production}`),
      url(production.toUpperCase()),
      url(production.replace("ep-", "%65p-")),
      url("", `?host=${encodeURIComponent(pooled(production))}`),
      // No host: pg would use PGHOST.
      url(""),
    ]) {
      assert.strictEqual(
        refusal(previewEnv(databaseUrl)),
        "this preview's database is production's.",
        databaseUrl,
      );
    }
  });

  it("lets a preview on its own branch through, without the Resend key", () => {
    const env = previewEnv(url(pooled(preview)));
    assert.isUndefined(refusal(env));
    assert.match(refusal({ ...env, RESEND_API_KEY: "re_123" })!, /RESEND_API_KEY/);
  });

  it("requires the direct URL, and production from main without TEST_OTP_CODE", () => {
    const urls = { DATABASE_URL: url(pooled(production)), DATABASE_URL_UNPOOLED: url(production) };
    const env = { ...urls, VERCEL_ENV: "production", VERCEL_GIT_COMMIT_REF: "main" };
    assert.isUndefined(refusal(env));
    assert.match(refusal({ ...env, DATABASE_URL_UNPOOLED: "" })!, /DATABASE_URL_UNPOOLED/);
    assert.match(refusal({ ...env, VERCEL_GIT_COMMIT_REF: "feature" })!, /only from main/);
    assert.match(refusal({ ...env, TEST_OTP_CODE: "424242" })!, /TEST_OTP_CODE/);
  });
});
