// Run by scripts/vercel-build.sh before anything touches a database. A preview must never migrate
// or use production's database, so it refuses when either URL reaches PRODUCTION_DATABASE_HOST
// (not a secret; set for Preview in Vercel). A new Vercel project's first Git deployment goes to
// production whatever its branch, so production builds only from main.
import { fileURLToPath } from "node:url";
import { parse } from "pg-connection-string";

// The host pg connects to, parsed the way pg parses it: a `?host=` query wins over the URL's host,
// and both are percent-decoded. Lowercased, since DNS ignores case. Empty means pg falls back to PGHOST.
export const databaseHost = (url: string) => (parse(url).host ?? "").toLowerCase();

// Neon's pooled host is the direct one with "-pooler" after the endpoint id.
const pooler = /^([^.]+)-pooler(?=\.|$)/;
export const isPooled = (host: string) => pooler.test(host);

export function refusal(env: Record<string, string | undefined>) {
  if (!env.DATABASE_URL) return "DATABASE_URL is not set.";
  if (!env.DATABASE_URL_UNPOOLED) return "DATABASE_URL_UNPOOLED is not set.";
  switch (env.VERCEL_ENV) {
    case "production":
      if (env.VERCEL_GIT_COMMIT_REF !== "main") {
        return `production builds only from main, not '${env.VERCEL_GIT_COMMIT_REF ?? ""}'.`;
      }
      if (env.TEST_OTP_CODE) return "TEST_OTP_CODE is set in production.";
      return;
    case "preview": {
      // Preview databases copy production's users; previews sign in with the seeded accounts.
      if (env.RESEND_API_KEY) return "RESEND_API_KEY is set on a preview.";
      if (!env.PRODUCTION_DATABASE_HOST) return "PRODUCTION_DATABASE_HOST is not set.";
      const endpoint = (host: string) => host.toLowerCase().replace(pooler, "$1");
      const production = endpoint(env.PRODUCTION_DATABASE_HOST);
      for (const url of [env.DATABASE_URL, env.DATABASE_URL_UNPOOLED]) {
        const host = endpoint(databaseHost(url));
        if (!host || host === production) return "this preview's database is production's.";
      }
      return;
    }
    default:
      return `VERCEL_ENV is '${env.VERCEL_ENV ?? ""}', not production or preview.`;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const reason = refusal(process.env);
  if (reason) {
    console.error(`Refusing to build: ${reason}`);
    process.exit(1);
  }
}
