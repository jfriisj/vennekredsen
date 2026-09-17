const { test, expect } = require("@playwright/test");

const sheetJsMock = String.raw`
window.XLSX = {
  utils: {
    book_new() { return { sheets: [] }; },
    aoa_to_sheet(data) { return { data }; },
    book_append_sheet(workbook, sheet, name) {
      workbook.sheets.push({ name, data: sheet.data });
    }
  },
  writeFile(workbook, filename) {
    window.__xlsxDownloads = window.__xlsxDownloads || [];
    window.__xlsxDownloads.push({ filename, sheets: workbook.sheets });
  }
};
`;

function inventoryItems() {
  return [
    {
      id: 1,
      name: "Cola",
      category: "Drikkevarer",
      unit: "liter",
      default_store: "Dagrofa",
      stock_quantity: 2,
      active: true,
    },
    {
      id: 2,
      name: "Pølser",
      category: "Mad",
      unit: "stk",
      default_store: "Bilka",
      stock_quantity: 10,
      active: true,
    },
  ];
}

function configuredItem(overrides = {}) {
  return {
    id: 10,
    inventory_item_id: 1,
    name: "Cola",
    category: "Drikkevarer",
    unit: "liter",
    default_store: "Dagrofa",
    stock_quantity: 2,
    inventory_active: true,
    per_adult_quantity: 1,
    per_child_quantity: 0.5,
    factor: 1.2,
    active: true,
    ...overrides,
  };
}

async function prepareAuthenticatedCalculator(page, role = "member") {
  const state = {
    lastCalculation: null,
    lastAddedItem: null,
    configurations: {
      sommerfest: [configuredItem()],
      julefest: [],
      fastelavn: [],
    },
  };

  await page.route("https://cdnjs.cloudflare.com/ajax/libs/xlsx/**", route =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: sheetJsMock,
    })
  );

  await page.route("**/api/me", route => {
    const authorization = route.request().headers().authorization;
    if (authorization !== `Bearer calculator-${role}-token`) {
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Invalid token!" }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: 1, username: `calculator-${role}`, role }),
    });
  });

  await page.route("**/api/inventory/items", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items: inventoryItems() }),
    })
  );

  await page.route("**/api/purchase-calculator/parties", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/purchase-calculator/parties") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          parties: [
            { id: 1, key: "sommerfest", name: "Sommerfest" },
            { id: 2, key: "julefest", name: "Julefest" },
            { id: 3, key: "fastelavn", name: "Fastelavn" },
          ],
        }),
      });
    }

    const itemMatch = path.match(
      /^\/api\/purchase-calculator\/parties\/([^/]+)\/items(?:\/(\d+))?$/
    );
    if (itemMatch) {
      const [, partyKey, itemId] = itemMatch;
      const data = request.postDataJSON?.() || {};

      if (request.method() === "POST") {
        state.lastAddedItem = data;
        const source = inventoryItems().find(
          item => item.id === data.inventory_item_id
        );
        const added = configuredItem({
          id: 20,
          inventory_item_id: source.id,
          name: source.name,
          category: source.category,
          unit: source.unit,
          default_store: source.default_store,
          stock_quantity: source.stock_quantity,
          per_adult_quantity: Number(data.per_adult_quantity),
          per_child_quantity: Number(data.per_child_quantity),
          factor: Number(data.factor),
        });
        state.configurations[partyKey].push(added);
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ item: added }),
        });
      }

      if (request.method() === "PATCH") {
        const item = state.configurations[partyKey].find(
          entry => entry.inventory_item_id === Number(itemId)
        );
        Object.assign(item, {
          per_adult_quantity: Number(data.per_adult_quantity),
          per_child_quantity: Number(data.per_child_quantity),
          factor: Number(data.factor),
          active: data.active,
        });
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ item }),
        });
      }

      if (request.method() === "DELETE") {
        const item = state.configurations[partyKey].find(
          entry => entry.inventory_item_id === Number(itemId)
        );
        item.active = false;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ item }),
        });
      }
    }

    const partyMatch = path.match(
      /^\/api\/purchase-calculator\/parties\/([^/]+)$/
    );
    if (partyMatch && request.method() === "GET") {
      const partyKey = partyMatch[1];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          party: {
            key: partyKey,
            name:
              partyKey === "sommerfest"
                ? "Sommerfest"
                : partyKey === "julefest"
                  ? "Julefest"
                  : "Fastelavn",
          },
          items: state.configurations[partyKey],
        }),
      });
    }

    return route.fallback();
  });

  await page.route("**/api/purchase-calculator/calculate", async route => {
    state.lastCalculation = route.request().postDataJSON();
    const subtractStock = state.lastCalculation.subtract_stock;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        party: { key: state.lastCalculation.party_key, name: "Sommerfest" },
        adults: Number(state.lastCalculation.adults),
        children: Number(state.lastCalculation.children),
        subtract_stock: subtractStock,
        items: [
          {
            inventory_item_id: 1,
            name: "Cola",
            category: "Drikkevarer",
            unit: "liter",
            default_store: "Dagrofa",
            stock_quantity: 2,
            per_adult_quantity: 1,
            per_child_quantity: 0.5,
            factor: 1.2,
            required_quantity: 14.4,
            suggested_purchase_quantity: subtractStock ? 12.4 : 14.4,
          },
          {
            inventory_item_id: 2,
            name: "Pølser",
            category: "Mad",
            unit: "stk",
            default_store: "Bilka",
            stock_quantity: 10,
            per_adult_quantity: 2,
            per_child_quantity: 1,
            factor: 1,
            required_quantity: 24,
            suggested_purchase_quantity: subtractStock ? 14 : 24,
          },
        ],
      }),
    });
  });

  await page.addInitScript(value => {
    localStorage.setItem("authToken", value);
  }, `calculator-${role}-token`);

  return state;
}

test("logged-out user is redirected from calculator", async ({ page }) => {
  await page.goto("/purchase-calculator.html");
  await expect(page).toHaveURL(/member-login\.html$/);
});

test("member can calculate, adjust, filter and export purchases", async ({
  page,
}) => {
  const state = await prepareAuthenticatedCalculator(page);
  await page.goto("/purchase-calculator.html");

  await expect(page.locator("#partySelect")).toHaveValue("sommerfest");
  await expect(page.getByRole("heading", { name: "Cola" })).toBeVisible();
  await expect(page.locator("#fileInput")).toHaveCount(0);

  await page.locator("#adultsInput").fill("10");
  await page.locator("#childrenInput").fill("4");
  await page.locator("#subtractStock").check();
  await page.getByRole("button", { name: "Beregn indkøb" }).click();

  expect(state.lastCalculation).toEqual({
    party_key: "sommerfest",
    adults: "10",
    children: "4",
    subtract_stock: true,
  });

  await expect(page.getByRole("cell", { name: "Cola" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Pølser" })).toBeVisible();
  await expect(page.locator("#resultsSummary")).toContainText(
    "lager trukket fra"
  );

  const colaOverride = page.getByLabel("Endeligt køb for Cola");
  await expect(colaOverride).toHaveValue("12.4");
  await colaOverride.fill("13");
  await colaOverride.blur();
  await expect(colaOverride).toHaveValue("13");

  await page.locator("#storeFilter").selectOption("Dagrofa");
  await expect(page.getByRole("cell", { name: "Cola" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Pølser" })).toHaveCount(0);

  await page.locator("#downloadCurrent").click();
  await page.locator("#downloadStore").click();
  await page.locator("#downloadCategory").click();

  await expect
    .poll(() =>
      page.evaluate(() =>
        (window.__xlsxDownloads || []).map(item => item.filename)
      )
    )
    .toEqual([
      "Indkob_beregnet.xlsx",
      "Indkob_efter_butik.xlsx",
      "Indkob_efter_kategori.xlsx",
    ]);
});

test("member can add Inventory item to a party configuration", async ({
  page,
}) => {
  const state = await prepareAuthenticatedCalculator(page);
  await page.goto("/purchase-calculator.html");

  await page.locator("#partySelect").selectOption("julefest");
  await page.locator("#inventoryItemSelect").selectOption("2");
  await page.locator("#addPerAdult").fill("2");
  await page.locator("#addPerChild").fill("1");
  await page.locator("#addFactor").fill("1.1");
  await page.getByRole("button", { name: "Tilføj vare" }).click();

  expect(state.lastAddedItem).toEqual({
    inventory_item_id: 2,
    per_adult_quantity: "2",
    per_child_quantity: "1",
    factor: "1.1",
  });
  await expect(page.getByRole("heading", { name: "Pølser" })).toBeVisible();
});

test("admin can use calculator", async ({ page }) => {
  await prepareAuthenticatedCalculator(page, "admin");
  await page.goto("/purchase-calculator.html");

  await expect(page.locator("#partySelect")).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Beregn indkøb" })
  ).toBeEnabled();
});

test("calculator stays inside a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepareAuthenticatedCalculator(page);
  await page.goto("/purchase-calculator.html");

  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth);
  await expect(page.locator("#calculationForm")).toBeVisible();
  await expect(page.locator("#configurationList")).toBeVisible();
});
