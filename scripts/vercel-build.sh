#!/usr/bin/env bash
# Vercel's build command: check the environment (scripts/guard.ts), migrate, then build.
set -euo pipefail

bun scripts/guard.ts
bun scripts/migrate.ts
if [ "$VERCEL_ENV" = preview ]; then bun scripts/seed.ts; fi
bun run build
