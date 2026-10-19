#!/usr/bin/env bash
# Vercel's build command: migrate, then build. A preview must never migrate or use production's
# database, so it refuses when either URL points at PRODUCTION_DATABASE_HOST (not a secret; set
# for Preview in Vercel). A new Vercel project's first Git deployment goes to production whatever
# its branch, so production builds only from main.
set -euo pipefail

refuse() {
  echo "Refusing to build: $1" >&2
  exit 1
}

# The host of a postgres:// URL, with Neon's "-pooler" suffix removed so pooled and direct match.
host() {
  sed -E 's#^[a-z]+://([^@/]*@)?([^:/?]+).*#\2#; s#-pooler\.#.#' <<<"$1"
}

: "${DATABASE_URL:?DATABASE_URL is not set}"
migration_url=${DATABASE_URL_UNPOOLED:-$DATABASE_URL}

case "${VERCEL_ENV:-}" in
  production)
    [ "${VERCEL_GIT_COMMIT_REF:-}" = main ] || refuse "production builds only from main, not '${VERCEL_GIT_COMMIT_REF:-}'."
    [ -z "${TEST_OTP_CODE:-}" ] || refuse "TEST_OTP_CODE is set in production."
    ;;
  preview)
    production=$(host "postgres://${PRODUCTION_DATABASE_HOST:?PRODUCTION_DATABASE_HOST is not set}")
    for url in "$DATABASE_URL" "$migration_url"; do
      [ "$(host "$url")" != "$production" ] || refuse "this preview's database is production's."
    done
    ;;
  *) refuse "VERCEL_ENV is '${VERCEL_ENV:-}', not production or preview." ;;
esac

bun scripts/migrate.ts
if [ "$VERCEL_ENV" = preview ]; then bun scripts/seed.ts; fi
bun run build
