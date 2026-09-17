const { test, expect } = require("@playwright/test");

test("member can permanently delete only an archived item", async ({ page }) => {
  const token = "playwright-member-token";
  const state = {
    items: [
      {
        id: 1,
        name: "Pepsi Max",
        category: "Drikkevarer",
        unit: "kasser",
        default_store: "Dagrofa",
        stock_quantity: 2,
        note: "",
        active: true,
        last_counted_at: null,
      },
    ],
  };

  await page.addInitScript(value => {
    localStorage.setItem("authToken", value);
  }, token);

  await page.route("https://cdnjs.cloudflare.com/**", route =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" })
  );

  await page.route("**/api/me", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: 2, username: "member", role: "member" }),
    })
  );

  await page.route("**/api/inventory/**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/inventory/items" && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: state.items }),
      });
      return;
    }

    if (url.pathname === "/api/inventory/items/1" && method === "DELETE") {
      state.items[0].active = false;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ item: state.items[0] }),
      });
      return;
    }

    if (
      url.pathname === "/api/inventory/items/1/permanent" &&
      method === "DELETE"
    ) {
      if (state.items[0]?.active) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            message: "Aktive varer skal arkiveres før permanent sletning",
          }),
        });
        return;
      }

      state.items = [];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Pepsi Max er slettet permanent" }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ message: "Not mocked" }),
    });
  });

  await page.goto("/inventory.html");
  await expect(page.getByRole("heading", { name: "Pepsi Max" })).toBeVisible();

  await page.getByRole("button", { name: "Redigér" }).click();
  await page.getByRole("button", { name: "Arkivér vare" }).click();
  await expect(page.locator("#archive-count")).toHaveText("1");

  await page.getByRole("button", { name: /Arkiv/ }).click();
  const archiveDialog = page.locator("#archiveDialog");
  await expect(archiveDialog.getByText("Pepsi Max", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Slet Pepsi Max permanent" })
  ).toBeVisible();

  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Slet Pepsi Max permanent" }).click();
  await expect(archiveDialog.getByText("Pepsi Max", { exact: true })).toBeVisible();
  expect(state.items).toHaveLength(1);

  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Slet Pepsi Max permanent" }).click();

  await expect(archiveDialog.getByText("Pepsi Max", { exact: true })).toBeHidden();
  await expect(page.locator("#archive-count")).toHaveText("0");
  await expect(page.locator("#inventoryStatus")).toHaveText(
    "Pepsi Max er slettet permanent."
  );
  expect(state.items).toHaveLength(0);
});
