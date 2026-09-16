const { test, expect } = require("@playwright/test");

function makeItem(overrides = {}) {
  return {
    id: 1,
    name: "Pepsi Max",
    category: "Drikkevarer",
    unit: "kasser",
    default_store: "Dagrofa",
    stock_quantity: 2,
    note: "",
    active: true,
    last_counted_at: null,
    ...overrides,
  };
}

async function prepareInventory(page, role = "member") {
  const token = `playwright-${role}-token`;
  const state = {
    items: [
      makeItem(),
      makeItem({
        id: 2,
        name: "Popcorn",
        category: "Snacks",
        unit: "poser",
        default_store: "Biltema",
        stock_quantity: 0,
      }),
    ],
    imported: null,
  };

  await page.addInitScript(value => {
    localStorage.setItem("authToken", value);
  }, token);

  await page.route("https://cdnjs.cloudflare.com/**", async route => {
    await route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });

  await page.addInitScript(() => {
    window.XLSX = {
      read() {
        return { Sheets: { indkob: {} } };
      },
      utils: {
        sheet_to_json() {
          return [
            ["Header"],
            ["Header"],
            ["Header"],
            ["Drikkevarer", "", ""],
            ["Vand", 0.5, 0.3, "liter", "", 10, "", "", "Dagrofa"],
          ];
        },
      },
    };
  });

  await page.route("**/api/me", async route => {
    if (route.request().headers().authorization !== `Bearer ${token}`) {
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

  await page.route("**/api/inventory/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (request.headers().authorization !== `Bearer ${token}`) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Invalid token!" }),
      });
      return;
    }

    if (url.pathname === "/api/inventory/items" && method === "GET") {
      const includeInactive = url.searchParams.get("include_inactive") === "true";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: includeInactive
            ? state.items
            : state.items.filter(item => item.active),
        }),
      });
      return;
    }

    if (url.pathname === "/api/inventory/items" && method === "POST") {
      const body = request.postDataJSON();
      const item = makeItem({
        ...body,
        id: Math.max(...state.items.map(entry => entry.id), 0) + 1,
        stock_quantity: body.stock_quantity || 0,
      });
      state.items.push(item);
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ item }),
      });
      return;
    }

    if (url.pathname === "/api/inventory/import" && method === "POST") {
      state.imported = request.postDataJSON().items;
      const importedItem = makeItem({
        id: 3,
        name: "Vand",
        category: "Drikkevarer",
        unit: "liter",
        stock_quantity: 0,
      });
      state.items.push(importedItem);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ created: 1, matched: 0, invalid: 0 }),
      });
      return;
    }

    const stockMatch = url.pathname.match(
      /^\/api\/inventory\/items\/(\d+)\/stock$/
    );
    if (stockMatch && method === "PATCH") {
      const id = Number(stockMatch[1]);
      const item = state.items.find(entry => entry.id === id);
      item.stock_quantity = request.postDataJSON().stock_quantity;
      item.last_counted_at = "2026-09-16T18:00:00";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ item }),
      });
      return;
    }

    const activeMatch = url.pathname.match(
      /^\/api\/inventory\/items\/(\d+)\/active$/
    );
    if (activeMatch && method === "PATCH") {
      const id = Number(activeMatch[1]);
      const item = state.items.find(entry => entry.id === id);
      item.active = request.postDataJSON().active;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ item }),
      });
      return;
    }

    const itemMatch = url.pathname.match(/^\/api\/inventory\/items\/(\d+)$/);
    if (itemMatch && method === "PUT") {
      const id = Number(itemMatch[1]);
      const item = state.items.find(entry => entry.id === id);
      Object.assign(item, request.postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ item }),
      });
      return;
    }

    if (itemMatch && method === "DELETE") {
      const id = Number(itemMatch[1]);
      const item = state.items.find(entry => entry.id === id);
      item.active = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ item }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: "Not mocked" }),
    });
  });

  return state;
}

test("logged-out user is redirected from inventory", async ({ page }) => {
  await page.goto("/inventory.html");
  await expect(page).toHaveURL(/member-login\.html$/);
});

test("member can count stock, filter and add an item", async ({ page }) => {
  const state = await prepareInventory(page);
  await page.goto("/inventory.html");

  await expect(page.getByRole("heading", { name: "Lager", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pepsi Max" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Popcorn" })).toBeVisible();

  await page.getByRole("button", { name: "Læg én til Pepsi Max" }).click();
  await expect(page.getByLabel("Lagerantal for Pepsi Max")).toHaveValue("3");
  await expect(page.locator("#inventoryStatus")).toContainText(
    "Pepsi Max er gemt med 3"
  );
  expect(state.items[0].stock_quantity).toBe(3);

  await page.locator("#stockFilter").selectOption("zero");
  await expect(page.getByRole("heading", { name: "Popcorn" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pepsi Max" })).toBeHidden();

  await page.locator("#stockFilter").selectOption("all");
  await page.locator("#searchInput").fill("pop");
  await expect(page.getByRole("heading", { name: "Popcorn" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pepsi Max" })).toBeHidden();

  await page.locator("#searchInput").fill("");
  await page.getByRole("button", { name: "Tilføj vare" }).click();
  await page.locator("#itemName").fill("Servietter");
  await page.locator("#itemCategory").fill("Diverse");
  await page.locator("#itemUnit").fill("pakker");
  await page.locator("#itemStock").fill("4");
  await page.getByRole("button", { name: "Gem vare" }).click();
  await expect(page.getByRole("heading", { name: "Servietter" })).toBeVisible();
});

test("member can archive and restore an item from the archive modal", async ({ page }) => {
  const state = await prepareInventory(page);
  await page.goto("/inventory.html");

  await page.getByRole("button", { name: "Redigér" }).first().click();
  await page.getByRole("button", { name: "Arkivér vare" }).click();
  expect(state.items[0].active).toBe(false);
  await expect(page.getByRole("heading", { name: "Pepsi Max" })).toBeHidden();
  await expect(page.locator("#archive-count")).toHaveText("1");

  await page.getByRole("button", { name: /Arkiv/ }).click();
  const archiveDialog = page.locator("#archiveDialog");
  await expect(archiveDialog).toBeVisible();
  await expect(archiveDialog.getByText("Pepsi Max", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Gendan Pepsi Max" }).click();

  expect(state.items[0].active).toBe(true);
  await expect(archiveDialog.getByText("Pepsi Max", { exact: true })).toBeHidden();
  await expect(page.locator("#archive-count")).toHaveText("0");
  await expect(page.getByRole("heading", { name: "Pepsi Max" })).toBeVisible();
});

test("member can import items from an indkob sheet", async ({ page }) => {
  const state = await prepareInventory(page);
  await page.goto("/inventory.html");

  await page.locator("#importFile").setInputFiles({
    name: "indkob.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("inventory-import"),
  });

  await expect(page.locator("#inventoryStatus")).toHaveText(
    "Import færdig: 1 oprettet, 0 eksisterede allerede, 0 ugyldige."
  );
  await expect(page.getByRole("heading", { name: "Vand" })).toBeVisible();
  expect(state.imported).toEqual([
    {
      name: "Vand",
      category: "Drikkevarer",
      unit: "liter",
      default_store: "Dagrofa",
    },
  ]);
});

test("admin can use inventory", async ({ page }) => {
  await prepareInventory(page, "admin");
  await page.goto("/inventory.html");
  await expect(page.locator("#inventoryList")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pepsi Max" })).toBeVisible();
});
