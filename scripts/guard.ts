// Run by scripts/vercel-build.sh before anything touches a database. A preview must never migrate
// or use production's database. Neon routes a connection by its endpoint id, which can ride in the
// hostname, the password (`endpoint=` or `project=`) or an `options` parameter, so a preview's URLs
// must be plain Neon URLs on production's exact domain whose endpoint isn't production's
// (PRODUCTION_DATABASE_HOST: not a secret, set for Preview in Vercel). This guards against
// misconfiguration, not against someone who can already set Vercel's variables. A new Vercel
// project's first Git deployment goes to production whatever its branch, so production builds
// only from main.
import { fileURLToPath } from "node:url";
import { parse } from "pg-connection-string";

type Env = Record<string, string | undefined>;

// Neon's hosts, exactly: ep-<id>.<region>.neon.tech, with "-pooler" after the id for the pooler.
const neonHost = /^(ep-[a-z0-9-]+?)(-pooler)?\.[a-z0-9-]+(\.[a-z0-9-]+)*\.neon\.tech$/;
const localHosts = ["localhost", "127.0.0.1"];

// A Neon host's endpoint id and whether it is the pooler; undefined for any other host.
export function neonEndpoint(host: string) {
  const match = neonHost.exec(host);
  return match ? { id: match[1]!, pooled: match[2] !== undefined } : undefined;
}

// The host a postgres URL connects to, when the URL alone decides it: the only query parameters
// are sslmode and channel_binding, nothing in it says `endpoint=` or `project=`, pg's own parser
// reads the same host, and a remote host is on Neon's port with a password of its own (pg reads
// PGPASSWORD only when the URL has none) and one sslmode that verifies the certificate (pg 8
// verifies for require; without sslmode it doesn't use TLS). Undefined otherwise, including when
// it doesn't parse. localhost and 127.0.0.1 serve dev and tests.
export function plainHost(url: string) {
  try {
    const { protocol, hostname, port, password, searchParams } = new URL(url);
    const decoded = decodeURIComponent(url).toLowerCase();
    const sslmode = searchParams.getAll("sslmode");
    const plain =
      (protocol === "postgresql:" || protocol === "postgres:") &&
      [...searchParams.keys()].every((key) => key === "sslmode" || key === "channel_binding") &&
      !decoded.includes("endpoint=") &&
      !decoded.includes("project=") &&
      (localHosts.includes(hostname) ||
        ((port === "" || port === "5432") &&
          password !== "" &&
          sslmode.length === 1 &&
          (sslmode[0] === "require" || sslmode[0] === "verify-full"))) &&
      parse(url).host === hostname;
    return plain && hostname ? hostname : undefined;
  } catch {
    return undefined;
  }
}

// pg reads PGOPTIONS (which can name a Neon endpoint) for every connection; PGHOSTADDR is libpq's
// override of the host. PGHOST is set by Vercel's Neon integration, and pg ignores it because
// plainHost requires the URL's own host.
const pgOverride = (env: Env) =>
  ["PGOPTIONS", "PGHOSTADDR"].find((name) => env[name] !== undefined);

// Why migrate.ts must not run on DATABASE_URL_UNPOOLED, if it mustn't. The advisory lock belongs to
// the session, which a pooler in transaction mode doesn't keep, so only a direct Neon host or a
// local server will do.
export function migrationRefusal(env: Env) {
  const override = pgOverride(env);
  if (override) return `${override} is set.`;
  const host = plainHost(env.DATABASE_URL_UNPOOLED ?? "") ?? "";
  const neon = neonEndpoint(host);
  if (localHosts.includes(host) || (neon && !neon.pooled)) return;
  return "DATABASE_URL_UNPOOLED is not a plain URL to a direct Neon host or localhost.";
}

export function refusal(env: Env) {
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
      // Previews sign in with the seeded accounts, never real mail.
      if (env.RESEND_API_KEY) return "RESEND_API_KEY is set on a preview.";
      const override = pgOverride(env);
      if (override) return `${override} is set.`;
      const production = neonEndpoint(env.PRODUCTION_DATABASE_HOST ?? "");
      if (!production) return "PRODUCTION_DATABASE_HOST is not a Neon host.";
      // Exactly <endpoint id>[-pooler].<production's host minus its first label>.
      const domain = env.PRODUCTION_DATABASE_HOST!.slice(
        env.PRODUCTION_DATABASE_HOST!.indexOf("."),
      );
      for (const url of [env.DATABASE_URL, env.DATABASE_URL_UNPOOLED]) {
        const host = plainHost(url) ?? "";
        const endpoint = host.slice(host.indexOf(".")) === domain ? neonEndpoint(host) : undefined;
        if (!endpoint) return "a database URL is not a plain Neon URL on production's domain.";
        if (endpoint.id === production.id) return "this preview's database is production's.";
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
