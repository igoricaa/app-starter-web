import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

// Trades the Vercel bypass for Vercel's host-only cookie in one request to the app's origin, without following
// redirects. The browser holds only the cookie, so the bypass never reaches another host.
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    if (bypass && baseURL) {
      const response = await context.request.get(baseURL, {
        headers: { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" },
        maxRedirects: 0,
      });
      if (!response.headers()["set-cookie"]?.includes("_vercel_jwt=")) {
        throw new Error(`Vercel returned no bypass cookie (HTTP ${response.status()}).`);
      }
    }
    await use(context);
  },
});
