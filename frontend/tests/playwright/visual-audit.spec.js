const { test, expect } = require("@playwright/test");

function resourcesFor(role) {
  const resources = [
    {
      id: "purchase-calculator",
      title: "Indkøbsberegner",
      description: "Beregn indkøb til arrangementer.",
      href: "purchase-calculator.html",
      available: true,
    },
    {
      id: "inventory",
      title: "Lager",
      description: "Administrér varekatalog og lageroptælling.",
      href: "inventory.html",
      available: true,
    },
    {
      id: "applications",
      title: "Ansøgninger",
      description: "Behandl indsendte ansøgninger.",
      href: "member.html#applications",
      available: true,
    },
    {
      id: "events",
      title: "Arrangementer",
      description: "Opdater datoer for arrangementer.",
      href: "member.html#events",
      available: true,
    },
  ];

  if (role === "admin") {
    resources.push(
      {
        id: "users",
        title: "Brugere",
        description: "Administrér brugere og roller.",
        href: "member.html#users",
        available: true,
      },
      {
        id: "website",
        title: "Hjemmeside",
        description: "Redigér udvalgt indhold på forsiden.",
        href: "member.html#website",
        available: true,
      }
    );
  }

  return resources;
}

async function mockSharedAuth(page, role = "admin") {
  await page.addInitScript(value => {
    localStorage.setItem("authToken", value);
  }, `visual-${role}-token`);

  await page.route("**/api/me", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: role === "admin" ? 1 : 2,
        username: `visual-${role}`,
        email: `${role}@example.com`,
        role,
      }),
    })
  );
}

async function mockMemberArea(page, role = "admin") {
  await mockSharedAuth(page, role);

  await page.route("**/api/member/resources", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ resources: resourcesFor(role) }),
    })
  );

  await page.route("**/api/member/applications", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 1,
          navn: "Anna Jensen",
          email: "anna@example.com",
          belob: 2500,
          beskrivelse: "Nye udendørs aktiviteter til skolegården.",
          status: "pending",
        },
        {
          id: 2,
          navn: "Peter Nielsen",
          email: "peter@example.com",
          belob: 1200,
          beskrivelse: "Materialer til fælles kreativ dag.",
          status: "approved",
        },
      ]),
    })
  );

  await page.route("**/api/member/events", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        events: {
          sommerfest: "2026-09-18T18:00:00",
          julefest: "2026-11-27T17:30:00",
          fastelavn: "2027-02-05T17:30:00",
        },
      }),
    })
  );

  await page.route("**/api/admin/users", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: 1,
          username: "visual-admin",
          email: "admin@example.com",
          role: "admin",
          is_active: true,
        },
        {
          id: 2,
          username: "visual-member",
          email: "member@example.com",
          role: "member",
          is_active: true,
        },
      ]),
    })
  );

  await page.route("**/api/admin/site-settings", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        settings: {
          hero_heading: "Vi gør gode idéer mulige.",
          hero_subheading:
            "Vennekredsen støtter aktiviteter og fællesskab omkring Hashøjskolen.",
          intro_text:
            "Vi hjælper gode initiativer videre med støtte og praktisk opbakning.",
          announcement_text: "Næste fælles arrangement er snart på vej.",
          announcement_visible: true,
        },
      }),
    })
  );
}

async function mockInventory(page) {
  await mockSharedAuth(page, "admin");
  await page.route("https://cdnjs.cloudflare.com/**", route =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" })
  );

  const items = [
    {
      id: 1,
      name: "Pepsi Max",
      category: "Drikkevarer",
      unit: "kasser",
      default_store: "Dagrofa",
      stock_quantity: 3,
      note: "",
      active: true,
      last_counted_at: "2026-09-16T18:00:00",
    },
    {
      id: 2,
      name: "Popcorn",
      category: "Snacks",
      unit: "poser",
      default_store: "Biltema",
      stock_quantity: 0,
      note: "",
      active: true,
      last_counted_at: null,
    },
    {
      id: 3,
      name: "Servietter",
      category: "Borddækning",
      unit: "pakker",
      default_store: "Dagrofa",
      stock_quantity: 4,
      note: "Hvide",
      active: true,
      last_counted_at: "2026-09-15T16:00:00",
    },
  ];

  await page.route("**/api/inventory/items?include_inactive=true", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items }),
    })
  );
}

async function mockCalculator(page) {
  await mockSharedAuth(page, "admin");
  await page.route("https://cdnjs.cloudflare.com/**", route =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" })
  );
}

async function saveScreenshot(page, testInfo, name) {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

test.describe("protected resource visual audit", () => {
  test("member dashboard", async ({ page }, testInfo) => {
    await mockMemberArea(page, "member");
    await page.goto("/member.html");
    await expect(
      page.getByRole("heading", { level: 1, name: "Medlemsområde" })
    ).toBeVisible();
    await saveScreenshot(page, testInfo, "member-dashboard");
  });

  test("admin dashboard", async ({ page }, testInfo) => {
    await mockMemberArea(page, "admin");
    await page.goto("/member.html");
    await expect(page.getByRole("heading", { name: "Hjemmeside" })).toBeVisible();
    await saveScreenshot(page, testInfo, "admin-dashboard");
  });

  for (const view of ["applications", "events", "users", "website"]) {
    test(`member resource view ${view}`, async ({ page }, testInfo) => {
      await mockMemberArea(page, "admin");
      await page.goto(`/member.html#${view}`);
      await expect(
        page.locator(`[data-resource-view="${view}"]`)
      ).toBeVisible();
      await saveScreenshot(page, testInfo, `resource-${view}`);
    });
  }

  test("inventory", async ({ page }, testInfo) => {
    await mockInventory(page);
    await page.goto("/inventory.html");
    await expect(
      page.getByRole("heading", { level: 1, name: "Lager" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pepsi Max" })).toBeVisible();
    await saveScreenshot(page, testInfo, "inventory");
  });

  test("purchase calculator", async ({ page }, testInfo) => {
    await mockCalculator(page);
    await page.goto("/purchase-calculator.html");
    await expect(
      page.getByRole("heading", { level: 1, name: "Indkøbsberegner" })
    ).toBeVisible();
    await saveScreenshot(page, testInfo, "purchase-calculator");
  });
});
