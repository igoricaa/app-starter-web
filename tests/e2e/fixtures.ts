import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

// Sends the Vercel bypass to the app's origin only; config-level extraHTTPHeaders would send it to every host the page calls.
export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    if (bypass && baseURL) {
      await context.route(`${new URL(baseURL).origin}/**`, (route) =>
        route.continue({
          headers: { ...route.request().headers(), "x-vercel-protection-bypass": bypass },
        }),
      );
    }
    await use(context);
  },
});
