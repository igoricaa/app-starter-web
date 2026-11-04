#!/usr/bin/env bash
# Writes the ignored .env.e2e that e2e.config.ts reads, for the browser walk on <url>: the URL, the
# Vercel protection bypass (previews only) and the sign-in code. Prints no secret.
# Usage: bash scripts/e2e-env.sh <preview URL | http://localhost:3000>
set -euo pipefail
url=${1:?usage: bash scripts/e2e-env.sh <preview URL | http://localhost:3000>}

code=$(sed -n "s/^TEST_OTP_CODE=//p" .env.local 2>/dev/null | tr -d "\n") || code=
[ -n "$code" ] || { echo "TEST_OTP_CODE is missing from .env.local" >&2; exit 1; }

bypass=
if [[ $url != http://localhost* ]]; then
  token=$(jq -r .token "$HOME/Library/Application Support/com.vercel.cli/auth.json")
  project=$(jq -r .projectId .vercel/project.json)
  team=$(jq -r .orgId .vercel/project.json)
  bypass=$(curl -fsS "https://api.vercel.com/v9/projects/$project?teamId=$team" \
    -K <(printf 'header = "Authorization: Bearer %s"\n' "$token") \
    | jq -r '[.protectionBypass // {} | to_entries[] | select(.value.scope == "automation-bypass") | .key][0] // empty')
  [ -n "$bypass" ] || { echo "the Vercel project has no automation bypass" >&2; exit 1; }
fi

umask 077
rm -f .env.e2e # a new file gets mode 600; an existing one would keep its mode
printf 'APP_URL=%s\nVERCEL_AUTOMATION_BYPASS_SECRET=%s\nTEST_OTP_CODE=%s\nE2E_TELEMETRY_DISABLED=1\n' \
  "$url" "$bypass" "$code" >.env.e2e
echo "Wrote .env.e2e for $url"
