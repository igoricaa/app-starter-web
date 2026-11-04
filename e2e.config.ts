import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { existsSync } from "node:fs";

// `bash scripts/e2e-env.sh <url>` writes this ignored file: the URL, the Vercel bypass and the sign-in code.
// `e2e mcp` starts with a bare environment, so the config reads them here.
if (existsSync(".env.e2e")) process.loadEnvFile(".env.e2e");

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
// e2e sends headers to the app's own site only, never to other hosts.
const headers = bypass ? { "x-vercel-protection-bypass": bypass } : undefined;
const app = { url: process.env.APP_URL ?? "http://localhost:3000" };

// The browser walk's two sizes; a session picks one by name. An app with dark mode adds
// `desktop-dark` and `mobile-dark` targets with `colorScheme: "dark"`.
export default {
  targets: [
    {
      name: "desktop",
      engine: web({ ...(headers && { headers }), viewport: { width: 1440, height: 900 } }),
      app,
    },
    {
      name: "mobile",
      engine: web({ ...(headers && { headers }), viewport: { width: 390, height: 844 } }),
      app,
    },
  ],
  secrets: {
    // The seeded accounts' fixed sign-in code, set only in dev and previews. A plain secret, because
    // e2e lets a `password` secret go only into a password field, and this one goes into a one-time-code field.
    "sign-in-code": () => process.env.TEST_OTP_CODE ?? "",
  },
} satisfies E2EConfig;
