import { expect, test } from "@playwright/test";

// Runs against the seeded `last-payment` scenario (Wanjiku + Faith paid, Amina pending), demo provider.
const shot = (name: string) => ({ path: `test-results/screens/${name}.png`, fullPage: false });

test("final contribution triggers exactly one automatic payout and receipts", async ({ page }) => {
  await page.goto("/");
  await page.waitForURL("**/welcome");
  await expect(page.getByRole("heading", { name: "Your chama, now on Lightning" })).toBeVisible();
  await page.screenshot(shot("02-welcome"));

  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: /Amina Otieno/ }).click();
  await page.waitForURL("**/home");
  await expect(page.getByRole("heading", { name: "Habari, Amina" })).toBeVisible();
  await expect(page.getByText("2/3 paid")).toBeVisible();
  await page.screenshot(shot("03-home"));

  await page.getByRole("link", { name: /Umoja Women Chama/ }).click();
  await expect(page.getByText("KES 10,000")).toBeVisible();
  await page.screenshot(shot("05-ledger"));

  await page.getByRole("link", { name: /Contribute KES 5,000/ }).first().click();
  await expect(page.getByText("Waiting for payment", { exact: false })).toBeVisible();
  await page.screenshot(shot("06-contribute"));

  // Copying is never payment evidence.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy invoice" }).click();
  await expect(page.getByText("Invoice copied. Waiting for payment.")).toBeVisible();
  await expect(page).toHaveURL(/contribute/);

  await page.getByRole("button", { name: /Simulate test-wallet payment/ }).click();
  await page.waitForURL("**/payments/**/success");
  await expect(page.getByRole("heading", { name: "Contribution received" })).toBeVisible();
  await expect(page.getByText("3 of 3 paid")).toBeVisible();
  await page.screenshot(shot("07-success"));

  await page.getByRole("link", { name: "See payout" }).click();
  await expect(page.getByText("Automatic payout sent")).toBeVisible({ timeout: 20_000 });
  await page.screenshot(shot("08-payout"));

  await page.getByRole("link", { name: "View receipt" }).click();
  await expect(page.getByText("TOTAL: KES 15,000")).toBeVisible();
  await page.screenshot(shot("10-receipt-payout"));

  // Back on the ledger: round 2 is open, history shows exactly one payout.
  await page.goto("/home");
  await page.getByRole("link", { name: /Umoja Women Chama/ }).click();
  await expect(page.getByText("Round 2 of 3")).toBeVisible();
  await expect(page.getByRole("link", { name: /Round 1 · Wanjiku/ })).toHaveCount(1);
});

test("diaspora payer covers an existing obligation with attribution", async ({ page }) => {
  await page.goto("/welcome?signin=1&next=/home");
  await page.getByRole("button", { name: /Faith/ }).click();
  await page.waitForURL("**/home");
  await page.getByRole("link", { name: /Total saved/ }).click();
  await expect(page.getByRole("heading", { name: "Pay in from abroad" })).toBeVisible();
  await expect(page.getByText("£1.02 – £1.32")).toBeVisible();
  await page.screenshot(shot("09-diaspora"));
  await page.getByRole("button", { name: /Pay £30.00/ }).click();
  await page.getByRole("button", { name: /Simulate test-wallet payment/ }).click();
  await page.waitForURL("**/payments/**/success");
  await expect(page.getByText(/Paid by Njeri \(London\)/)).toBeVisible();
  await page.getByRole("link", { name: "View receipt" }).click();
  await expect(page.getByText("Diaspora contribution receipt")).toBeVisible();
  await page.screenshot(shot("10-receipt-diaspora"));
});

test("create chama form persists rules and surfaces an invite", async ({ page }) => {
  await page.goto("/welcome?signin=1&next=/chamas/new");
  await page.getByRole("button", { name: /Wanjiku/ }).click();
  await page.waitForURL("**/chamas/new");
  await expect(page.getByRole("heading", { name: "Create a chama" })).toBeVisible();
  await page.screenshot(shot("04-create"));
  await page.getByLabel("Chama name").fill("Test Circle");
  await page.getByRole("button", { name: "Create and invite members" }).click();
  await page.waitForURL(/\/chamas\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Invite code", { exact: true })).toBeVisible();
  await expect(page.getByText(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{2}$/)).toBeVisible();
});

test("non-members cannot read another chama's ledger", async ({ request }) => {
  const res = await request.get("/api/chamas/00000000-0000-4000-8000-000000000000/ledger");
  expect(res.status()).toBe(401);
});
