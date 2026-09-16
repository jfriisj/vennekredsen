const { test, expect } = require("@playwright/test");

const sheetJsMock = String.raw`
window.XLSX = {
  read(buffer) {
    const marker = new TextDecoder().decode(buffer);
    if (marker.includes("missing-sheet")) return { Sheets: {} };
    return {
      Sheets: {
        indkob: {
          __rows: [
            ["", "", ""],
            ["", "", ""],
            ["", "", ""],
            ["Drikkevarer", "", ""],
            ["Cola", 1, 0.5, "liter", "", 12, "Jon", "Kold", "Dagrofa"],
            ["Vand", 1, 1, "liter", "", 18, "Anna", "", "Bilka"],
            ["Mad", "", ""],
            ["Pølser", 2, 1, "stk", "", 30, "Jon", "", "Dagrofa"]
          ]
        }
      }
    };
  },
  utils: {
    sheet_to_json(sheet) { return sheet.__rows; },
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

async function prepareAuthenticatedCalculator(page, role = "member") {
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

  await page.addInitScript(value => {
    localStorage.setItem("authToken", value);
  }, `calculator-${role}-token`);
}

async function uploadMarker(page, marker, name = "indkob.xlsx") {
  await page.locator("#fileInput").setInputFiles({
    name,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(marker),
  });
}

test("logged-out user is redirected from calculator", async ({ page }) => {
  await page.goto("/purchase-calculator.html");
  await expect(page).toHaveURL(/member-login\.html$/);
});

test("member can parse, filter and export purchase data", async ({ page }) => {
  await prepareAuthenticatedCalculator(page);
  await page.goto("/purchase-calculator.html");

  await expect(page.locator("#fileInput")).toBeEnabled();
  await uploadMarker(page, "valid-sheet");

  await expect(page.locator("#totalVarer")).toHaveText("3");
  await expect(page.locator("#totalSteder")).toHaveText("2");
  await expect(page.locator("#totalKategorier")).toHaveText("2");
  await expect(page.locator("#visibleVarer")).toHaveText("3");
  await expect(page.getByText("3 varer indlæst fra indkob.xlsx.")).toBeVisible();

  await page.locator("#indkobssted").selectOption("Dagrofa");
  await expect(page.locator("#visibleVarer")).toHaveText("2");
  await expect(page.getByRole("cell", { name: "Cola" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Pølser" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Vand" })).toHaveCount(0);

  await page.locator("#kategori").selectOption("Drikkevarer");
  await expect(page.locator("#visibleVarer")).toHaveText("1");
  await expect(page.locator("#resultsTitle")).toHaveText("Drikkevarer - Dagrofa");

  await page.locator("#downloadCurrent").click();
  await page.locator("#downloadStore").click();
  await page.locator("#downloadCategory").click();

  await expect
    .poll(() =>
      page.evaluate(() => (window.__xlsxDownloads || []).map(item => item.filename))
    )
    .toEqual([
      "Indkob_filtreret.xlsx",
      "Indkob_efter_butik.xlsx",
      "Indkob_efter_kategori.xlsx",
    ]);
});

test("admin can use calculator", async ({ page }) => {
  await prepareAuthenticatedCalculator(page, "admin");
  await page.goto("/purchase-calculator.html");
  await expect(page.locator("#fileInput")).toBeEnabled();
});

test("missing indkob sheet shows a clear error", async ({ page }) => {
  await prepareAuthenticatedCalculator(page);
  await page.goto("/purchase-calculator.html");
  await uploadMarker(page, "missing-sheet", "forkert.xlsx");

  await expect(page.locator("#statusMessage")).toHaveText(
    "Filen mangler det forventede ark indkob."
  );
  await expect(page.locator("#statusMessage")).toHaveAttribute("data-state", "error");
  await expect(page.locator("#downloadCurrent")).toBeDisabled();
});
