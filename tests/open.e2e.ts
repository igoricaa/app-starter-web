import { test } from "@e2e-dev/web";

// The browser walk opens every e2e mcp session with this test (open_session's `test`). On a preview it trades
// the Vercel bypass for Vercel's host-only cookie in one request to the app, so the browser never holds the
// bypass: e2e's own `headers` option would send it to every *.vercel.app host.
test("open the app", async ({ app, browser }) => {
  const url = process.env.APP_URL ?? "http://localhost:3000";
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypass) {
    const response = await fetch(url, {
      headers: { "x-vercel-protection-bypass": bypass, "x-vercel-set-bypass-cookie": "true" },
      redirect: "manual",
    });
    const jwt = /_vercel_jwt=([^;]+)/.exec(response.headers.get("set-cookie") ?? "")?.[1];
    if (!jwt) throw new Error(`Vercel returned no bypass cookie (HTTP ${response.status}).`);
    await browser.setCookies([
      { url, name: "_vercel_jwt", value: jwt, httpOnly: true, secure: true, sameSite: "Lax" },
    ]);
  }
  await app.open("/");
});
