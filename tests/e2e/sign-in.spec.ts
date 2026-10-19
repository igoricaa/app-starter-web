import { expect, test } from "@playwright/test";

const code = process.env.TEST_OTP_CODE;

test("the seeded account signs in, keeps its session on reload, and signs out", async ({
  page,
}) => {
  if (!code) throw new Error("Set TEST_OTP_CODE to the code configured on the deployment.");

  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);

  // Submit buttons stay disabled until hydration; typing earlier would be lost.
  const sendCode = page.getByRole("button", { name: "Send code" });
  await expect(sendCode).toBeEnabled();
  await page.getByLabel("Email").fill("test@example.test");
  await sendCode.click();
  await page.getByLabel(/Code sent to/).fill(code);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("You are signed in")).toBeVisible();

  await page.getByRole("link", { name: "Account", exact: true }).click();
  await expect(page.getByLabel("Display name")).toHaveValue("Test User");
  await page.reload();
  await expect(page.getByLabel("Display name")).toHaveValue("Test User");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in$/);
});
