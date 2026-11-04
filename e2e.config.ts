import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

// `bash scripts/e2e-env.sh <url>` writes this ignored file: the URL, the Vercel bypass and the sign-in code.
// `e2e mcp` starts with a bare environment and loads the config for every session, so each load overwrites.
if (existsSync(".env.e2e")) Object.assign(process.env, parseEnv(readFileSync(".env.e2e", "utf8")));

const app = { url: process.env.APP_URL ?? "http://localhost:3000" };

// The browser walk's two sizes. Each session opens with tests/open.e2e.ts, which gets past Vercel protection.
export default {
  targets: [
    { name: "desktop", engine: web({ viewport: { width: 1440, height: 900 } }), app },
    { name: "mobile", engine: web({ viewport: { width: 390, height: 844 } }), app },
  ],
  secrets: {
    // The seeded accounts' fixed sign-in code, set only in dev and previews. A plain secret, because
    // e2e lets a `password` secret go only into a password field, and this one goes into a one-time-code field.
    "sign-in-code": () => process.env.TEST_OTP_CODE ?? "",
  },
} satisfies E2EConfig;
