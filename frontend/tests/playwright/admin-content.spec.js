const { test, expect } = require("@playwright/test");

const defaultSettings = {
  hero_heading: "Vi gør gode idéer mulige.",
  hero_subheading: "Standard hero tekst",
  intro_text: "Standard mission",
  announcement_text: "",
  announcement_visible: false,
};

function resourcesFor(role) {
  const shared = [
    {
      id: "purchase-calculator",
      title: "Indkøbsberegner",
      description: "Indkøb",
      href: "purchase-calculator.html",
      available: true,
    },
    {
      id: "inventory",
      title: "Lager",
      description: "Lager",
      href: "inventory.html",
      available: true,
    },
    {
      id: "applications",
      title: "Ansøgninger",
      description: "Ansøgninger",
      href: "member.html#applications",
      available: true,
    },
    {
      id: "events",
      title: "Arrangementer",
      description: "Arrangementer",
      href: "member.html#events",
      available: true,
    },
  ];

  if (role === "admin") {
    shared.push(
      {
        id: "users",
        title: "Brugere",
        description: "Brugere",
        href: "member.html#users",
        available: true,
      },
      {
        id: "website",
        title: "Hjemmeside",
        description: "Hjemmeside",
        href: "member.html#website",
        available: true,
      }
    );
  }
  return shared;
}

async function mockMemberAreaApis(page, role = "member") {
  let settings = { ...defaultSettings };
  let users = [
    {
      id: 1,
      username: "playwright-admin",
      email: "admin@example.com",
      role: "admin",
      is_active: true,
    },
    {
      id: 2,
      username: "playwright-member",
      email: "member@example.com",
      role: "member",
      is_active: true,
    },
  ];

  await page.route("**/api/me", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: role === "admin" ? 1 : 2,
        username: `playwright-${role}`,
        email: `${role}@example.com`,
        role,
      }),
    })
  );

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
          navn: "Test Ansøger",
          email: "test@example.com",
          belob: 1500,
          beskrivelse: "Testprojekt",
          status: "pending",
        },
      ]),
    })
  );

  await page.route("**/api/member/applications/*/status", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ message: "Updated" }),
    })
  );

  await page.route("**/api/member/events", async route => {
    const events = {
      sommerfest: "2026-09-18T18:00:00",
      julefest: "2026-11-27T17:30:00",
      fastelavn: "2027-02-05T17:30:00",
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ events }),
    });
  });

  await page.route("**/api/admin/users", async route => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      users.push({
        id: 3,
        username: input.username,
        email: input.email,
        role: input.role,
        is_active: true,
      });
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ message: "Bruger oprettet" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(users),
    });
  });

  await page.route("**/api/admin/users/*", async route => {
    const id = Number(route.request().url().split("/").pop());
    const input = route.request().postDataJSON();
    const user = users.find(item => item.id === id);
    Object.assign(user, input);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user }),
    });
  });

  await page.route("**/api/admin/site-settings", async route => {
    if (route.request().method() === "PUT") {
      settings = route.request().postDataJSON();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ settings }),
    });
  });

  return {
    getSettings: () => settings,
    getUsers: () => users,
  };
}

async function openMemberArea(page, role = "member", hash = "") {
  await mockMemberAreaApis(page, role);
  await page.addInitScript(() => {
    localStorage.setItem("authToken", "playwright-auth-token");
  });
  await page.goto(`/member.html${hash}`);
}

test("member area redirects when no auth token exists", async ({ page }) => {
  await page.goto("/member.html");
  await expect(page).toHaveURL(/member-login\.html$/);
});

test("member sees four shared resources", async ({ page }) => {
  await openMemberArea(page, "member");

  await expect(page.getByRole("heading", { name: "Indkøbsberegner" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lager" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ansøgninger" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Arrangementer" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Brugere" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Hjemmeside" })).toHaveCount(0);
});

test("member can open applications and events from resources", async ({ page }) => {
  await openMemberArea(page, "member");

  await page.getByRole("link", { name: "Åbn Ansøgninger" }).click();
  await expect(page.locator('[data-resource-view="applications"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: "Test Ansøger" })).toBeVisible();

  await page.getByRole("button", { name: "← Ressourcer" }).click();
  await page.getByRole("link", { name: "Åbn Arrangementer" }).click();
  await expect(page.locator('[data-resource-view="events"]')).toBeVisible();
  await expect(page.locator('[name="sommerfest"]')).toHaveValue("2026-09-18T18:00");
});

test("admin sees shared and admin-only resources", async ({ page }) => {
  await openMemberArea(page, "admin");

  for (const name of [
    "Indkøbsberegner",
    "Lager",
    "Ansøgninger",
    "Arrangementer",
    "Brugere",
    "Hjemmeside",
  ]) {
    await expect(page.getByRole("heading", { name })).toBeVisible();
  }
});

test("admin can edit homepage settings from member resources", async ({ page }) => {
  const state = await mockMemberAreaApis(page, "admin");
  await page.addInitScript(() => {
    localStorage.setItem("authToken", "playwright-admin-token");
  });
  await page.goto("/member.html#website");

  await page.locator('[name="hero_heading"]').fill("Ny overskrift");
  await page.locator('[name="hero_subheading"]').fill("Ny hero tekst");
  await page.locator('[name="intro_text"]').fill("Ny missionstekst");
  await page.locator('[name="announcement_text"]').fill("Vigtig besked");
  await page.locator('[name="announcement_visible"]').check();
  await page.getByRole("button", { name: "Gem hjemmesideindhold" }).click();

  await expect(page.getByText("Hjemmesidens indhold er gemt.")).toBeVisible();
  expect(state.getSettings()).toEqual({
    hero_heading: "Ny overskrift",
    hero_subheading: "Ny hero tekst",
    intro_text: "Ny missionstekst",
    announcement_text: "Vigtig besked",
    announcement_visible: true,
  });
});

test("admin can change a user role and active state from member resources", async ({
  page,
}) => {
  const state = await mockMemberAreaApis(page, "admin");
  await page.addInitScript(() => {
    localStorage.setItem("authToken", "playwright-admin-token");
  });
  await page.goto("/member.html#users");

  const memberCard = page.locator(".user-card").filter({
    hasText: "playwright-member",
  });
  await memberCard.locator("select").selectOption("admin");
  await memberCard.locator('input[type="checkbox"]').uncheck();
  await memberCard.getByRole("button", { name: "Gem bruger" }).click();

  await expect(page.getByText("Brugeren playwright-member er opdateret.")).toBeVisible();
  const member = state.getUsers().find(user => user.username === "playwright-member");
  expect(member.role).toBe("admin");
  expect(member.is_active).toBe(false);
});

test("homepage renders public site settings as text", async ({ page }) => {
  await page.route("**/api/site-settings", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        settings: {
          hero_heading: "Dynamisk overskrift",
          hero_subheading: "Dynamisk undertekst",
          intro_text: "Dynamisk mission",
          announcement_text: "<strong>Dette er tekst</strong>",
          announcement_visible: true,
        },
      }),
    })
  );
  await page.route("**/api/events", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ events: {} }),
    })
  );
  await page.route("**/api/approved-projects", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/index.html");

  await expect(page.locator("[data-site-hero-heading]")).toHaveText(
    "Dynamisk overskrift"
  );
  await expect(page.locator("[data-site-hero-subheading]")).toHaveText(
    "Dynamisk undertekst"
  );
  await expect(page.locator("[data-site-intro]")).toHaveText("Dynamisk mission");
  await expect(page.locator("[data-site-announcement]")).toBeVisible();
  await expect(page.locator("[data-site-announcement-text]")).toHaveText(
    "<strong>Dette er tekst</strong>"
  );
  await expect(page.locator("[data-site-announcement-text] strong")).toHaveCount(0);
});
