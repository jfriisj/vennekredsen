const { test, expect } = require("@playwright/test");

async function mockMemberApis(page, role = "member") {
  await page.route("**/api/login", async route => {
    const login = route.request().postDataJSON();

    if (
      login.username === `playwright-${role}` &&
      login.password === "correct-password"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          token: `playwright-${role}-token`,
          user: {
            id: 1,
            username: `playwright-${role}`,
            role,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Forkert brugernavn eller adgangskode",
      }),
    });
  });

  await page.route("**/api/me", async route => {
    const authorization = route.request().headers().authorization;

    if (authorization !== `Bearer playwright-${role}-token`) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Invalid token!" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        username: `playwright-${role}`,
        role,
      }),
    });
  });

  await page.route("**/api/member/resources", async route => {
    const authorization = route.request().headers().authorization;

    if (authorization !== `Bearer playwright-${role}-token`) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Invalid token!" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        resources: [
          {
            id: "purchase-calculator",
            title: "Indkøbsberegner",
            description: "Beregn indkøb til arrangementer.",
            href: "purchase-calculator.html",
            available: true,
          },
        ],
      }),
    });
  });
}

test("member area redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/member.html");

  await expect(page).toHaveURL(/member-login\.html$/);
});

test("member can log in, view resources and log out", async ({ page }, testInfo) => {
  await mockMemberApis(page, "member");

  await page.goto("/member-login.html");

  await page.locator("#username").fill("playwright-member");
  await page.locator("#password").fill("correct-password");

  await Promise.all([
    page.waitForURL("**/member.html"),
    page.locator("#loginBtn").click(),
  ]);

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Medlemsområde",
    })
  ).toBeVisible();

  await expect(page.getByText("Logget ind som playwright-member.")).toBeVisible();

  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Indkøbsberegner",
    })
  ).toBeVisible();

  await expect(page.getByText("Tilgængelig")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Åbn Indkøbsberegner" })
  ).toHaveAttribute("href", "purchase-calculator.html");

  await expect(
    page.evaluate(() => localStorage.getItem("authToken"))
  ).resolves.toBe("playwright-member-token");

  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Menu" }).click();
  }

  await page.getByRole("button", { name: "Log ud" }).click();

  await expect(page).toHaveURL(/member-login\.html$/);

  await expect(
    page.evaluate(() => localStorage.getItem("authToken"))
  ).resolves.toBeNull();

  await page.goto("/member.html");

  await expect(page).toHaveURL(/member-login\.html$/);
});

test("admin can use the member area", async ({ page }) => {
  await mockMemberApis(page, "admin");

  await page.goto("/member-login.html");

  await page.locator("#username").fill("playwright-admin");
  await page.locator("#password").fill("correct-password");

  await Promise.all([
    page.waitForURL("**/member.html"),
    page.locator("#loginBtn").click(),
  ]);

  await expect(page.getByText("Logget ind som playwright-admin.")).toBeVisible();

  await expect(
    page.getByRole("heading", {
      level: 3,
      name: "Indkøbsberegner",
    })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Åbn Indkøbsberegner" })
  ).toBeVisible();
});
