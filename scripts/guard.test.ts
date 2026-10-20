import { assert, describe, it } from "vitest";
import { migrationRefusal, refusal } from "./guard";

const production = "ep-prod-123.c-2.eu-central-1.aws.neon.tech";
const preview = "ep-preview-456.c-2.eu-central-1.aws.neon.tech";
const pooled = (host: string) => host.replace(/^([^.]+)/, "$1-pooler");
const query = "?channel_binding=require&sslmode=require";
const url = (host: string, rest = query, password = "password") =>
  `postgresql://neondb_owner:${password}@${host}/neondb${rest}`;
const previewEnv = (databaseUrl: string) => ({
  VERCEL_ENV: "preview",
  PRODUCTION_DATABASE_HOST: production,
  DATABASE_URL: databaseUrl,
  DATABASE_URL_UNPOOLED: url(preview),
});

describe("the build guard", () => {
  it("lets a preview on its own branch through, in the shape Vercel's Neon integration sets", () => {
    // The integration also sets PGHOST and PGPASSWORD; pg ignores both for these URLs.
    const env = {
      ...previewEnv(url(pooled(preview))),
      PGHOST: pooled(preview),
      PGPASSWORD: "fake-password",
    };
    assert.isUndefined(refusal(env));
    assert.isUndefined(refusal({ ...env, DATABASE_URL: url(pooled(preview), "?sslmode=require") }));
    assert.match(refusal({ ...env, RESEND_API_KEY: "re_123" })!, /RESEND_API_KEY/);
  });

  it("refuses a preview URL that reaches production, or might", () => {
    for (const databaseUrl of [
      url(pooled(production)),
      url(production),
      url(`${pooled(production)}.`),
      url(production.toUpperCase()),
      url(production.replace("ep-", "%65p-")),
      url(pooled(preview), `${query}&options=endpoint%3Dep-prod-123`),
      url(pooled(preview), "?options=endpoint%3Dep-prod-123"),
      url(pooled(preview), query, "endpoint=ep-prod-123;password"),
      url(pooled(preview), query, "endpoint%3Dep-prod-123%24password"),
      url(pooled(preview), `?host=${production}`),
      url("", `?host=${encodeURIComponent(pooled(production))}`),
      url("3.125.57.42", `?options=endpoint%3Dep-prod-123`),
      url("3.125.57.42"),
      url(`${pooled(preview)}:6543`),
      // No host: pg would use PGHOST.
      url(""),
      url(`${preview}.evil.example`),
      "not a url",
      "",
    ]) {
      assert.isDefined(refusal(previewEnv(databaseUrl)), databaseUrl);
      assert.isDefined(
        refusal({ ...previewEnv(url(pooled(preview))), DATABASE_URL_UNPOOLED: databaseUrl }),
        databaseUrl,
      );
    }
    assert.strictEqual(
      refusal(previewEnv(url(pooled(production)))),
      "this preview's database is production's.",
    );
  });

  it("refuses a host off production's exact domain", () => {
    for (const host of [
      "ep-preview-456.extra.c-2.eu-central-1.aws.neon.tech",
      "ep-preview-456-pooler.extra.c-2.eu-central-1.aws.neon.tech",
      "ep-preview-456.c-3.eu-central-1.aws.neon.tech",
      "ep-preview-456.eu-central-1.aws.neon.tech",
    ]) {
      assert.match(refusal(previewEnv(url(host)))!, /production's domain/, host);
    }
  });

  it("refuses a URL whose TLS might not verify", () => {
    for (const rest of [
      "?sslmode=no-verify",
      "?sslmode=disable",
      "?sslmode=allow",
      "?sslmode=prefer",
      "?sslmode=verify-ca",
      "?channel_binding=require",
      "?sslmode=require&sslmode=no-verify",
      "",
    ]) {
      assert.isDefined(refusal(previewEnv(url(pooled(preview), rest))), rest);
    }
    assert.isUndefined(refusal(previewEnv(url(pooled(preview), "?sslmode=verify-full"))));
  });

  it("refuses Neon's endpoint in the password, or no password (pg would read PGPASSWORD)", () => {
    for (const password of [
      "project=ep-prod-123;fake-secret",
      "project=ep-prod-123-pooler;fake-secret",
      "project%3Dep-prod-123%3Bfake-secret",
      "PROJECT=ep-prod-123;fake-secret",
      "",
    ]) {
      assert.isDefined(refusal(previewEnv(url(pooled(preview), query, password))), password);
    }
    const noPassword = `postgresql://neondb_owner@${pooled(preview)}/neondb${query}`;
    const env = { ...previewEnv(noPassword), PGPASSWORD: "endpoint=ep-prod-123;fake-secret" };
    assert.isDefined(refusal(env));
  });

  it("refuses the reviewer's combined URL", () => {
    const crafted = url(
      "ep-preview-456.extra.c-2.eu-central-1.aws.neon.tech",
      "?sslmode=no-verify",
      "project=ep-prod-123;fake-secret",
    );
    assert.isDefined(refusal(previewEnv(crafted)));
    assert.isDefined(migrationRefusal({ DATABASE_URL_UNPOOLED: crafted }));
  });

  it("refuses a preview with PGOPTIONS or PGHOSTADDR, or no Neon production host", () => {
    const env = previewEnv(url(pooled(preview)));
    assert.match(refusal({ ...env, PGOPTIONS: "endpoint=ep-prod-123" })!, /PGOPTIONS/);
    assert.match(refusal({ ...env, PGHOSTADDR: "3.125.57.42" })!, /PGHOSTADDR/);
    for (const host of [undefined, `${production}.`, "3.125.57.42"]) {
      assert.match(
        refusal({ ...env, PRODUCTION_DATABASE_HOST: host })!,
        /PRODUCTION_DATABASE_HOST/,
      );
    }
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

describe("the migration guard", () => {
  it("accepts a direct Neon URL or a local server", () => {
    for (const direct of [
      url(preview),
      "postgresql://postgres@localhost:5432/postgres",
      "postgresql://postgres@127.0.0.1:61234/app_template",
    ]) {
      assert.isUndefined(migrationRefusal({ DATABASE_URL_UNPOOLED: direct, PGHOST: "x" }), direct);
    }
  });

  it("refuses a pooled, hostless, rerouted or unparseable URL, and PGOPTIONS", () => {
    for (const direct of [
      undefined,
      url(pooled(preview)),
      "postgresql://u:p@/db",
      url("", `?host=${preview}`),
      url(preview, "?options=endpoint%3Dep-prod-123"),
      url(preview, "?sslmode=no-verify"),
      url(preview, ""),
      url(preview, query, "project=ep-prod-123;fake-secret"),
      url(preview, query, ""),
      url("localhost", `?host=${pooled(preview)}`),
      "not a url",
    ]) {
      assert.isDefined(
        migrationRefusal({ DATABASE_URL_UNPOOLED: direct, PGHOST: pooled(preview) }),
        direct,
      );
    }
    assert.match(
      migrationRefusal({ DATABASE_URL_UNPOOLED: url(preview), PGOPTIONS: "x" })!,
      /PGOPTIONS/,
    );
  });
});
