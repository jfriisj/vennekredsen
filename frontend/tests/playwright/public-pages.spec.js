const { test, expect } = require("@playwright/test");

async function mockHomepageApi(page) {
    await page.route("**/api/site-settings", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                settings: {
                    hero_heading: "Vi gør gode idéer mulige.",
                    hero_subheading:
                        "Vennekredsen samler midler og frivillige kræfter, så børnene på Hashøjskolen får flere oplevelser, stærkere fællesskaber og bedre rammer i hverdagen.",
                    intro_text:
                        "Vennekredsen arbejder for, at økonomi ikke bliver en barriere for børnenes deltagelse i oplevelser og aktiviteter omkring skolen.",
                    announcement_text: "",
                    announcement_visible: false,
                },
            }),
        });
    });

    await page.route("**/api/events", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                events: {
                    sommerfest: "2026-09-18T18:00:00",
                    julefest: "2026-11-27T17:30:00",
                    fastelavn: "2027-02-05T17:30:00",
                },
            }),
        });
    });

    await page.route("**/api/approved-projects", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([
                {
                    id: 1,
                    belob: 2500,
                    beskrivelse:
                        "Støtte til en fælles oplevelse for børnene på Hashøjskolen",
                    godkendt_dato: "2026-09-10",
                },
            ]),
        });
    });
}

async function mockEventsApi(page) {
    await page.route("**/api/events", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                events: {
                    sommerfest: "2026-10-03T14:15:00",
                    julefest: "2026-12-04T18:45:00",
                    fastelavn: "2027-02-12T16:30:00",
                },
            }),
        });
    });
}

async function mockApplicationApi(page) {
    const state = {
        submittedApplication: null,
    };

    await page.route("**/api/approved-projects", async route => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([
                {
                    id: 2,
                    belob: 1800,
                    beskrivelse:
                        "Fælles kreative aktiviteter for børnene på Hashøjskolen",
                    godkendt_dato: "2026-09-12",
                },
            ]),
        });
    });

    await page.route("**/api/ansoegning", async route => {
        state.submittedApplication = route.request().postDataJSON();

        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                message: "Application submitted successfully",
            }),
        });
    });

    return state;
}

async function mockAdminLoginApi(page) {
    await page.route("**/api/admin/login", async route => {
        const login = route.request().postDataJSON();

        if (
            login.username === "playwright-admin" &&
            login.password === "correct-password"
        ) {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    token: "playwright-admin-token",
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

    await page.route("**/admin-panel.html", async route => {
        await route.fulfill({
            status: 200,
            contentType: "text/html",
            body: "<!doctype html><title>Admin panel</title><h1>Admin panel</h1>",
        });
    });
}

function captureBrowserErrors(page) {
    const errors = [];

    page.on("console", message => {
        if (message.type() === "error") {
            errors.push(`console: ${message.text()}`);
        }
    });

    page.on("pageerror", error => {
        errors.push(`pageerror: ${error.message}`);
    });

    return errors;
}

async function expectNoHorizontalOverflow(page) {
    const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
    }));

    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

async function verifyNavigation(page, testInfo) {
    const navigation = page.getByRole("navigation", {
        name: "Primær navigation",
    });

    await expect(navigation).toBeVisible();

    if (testInfo.project.name === "mobile-chromium") {
        await page.getByRole("button", { name: "Menu" }).click();
    }

    await expect(navigation.getByRole("link", { name: "Om os" })).toBeVisible();

    await expect(
        navigation.getByRole("link", { name: "Arrangementer" })
    ).toBeVisible();

    await expect(
        navigation.getByRole("link", { name: "Ansøg om støtte" })
    ).toBeVisible();

    await expect(navigation.getByRole("link", { name: "Login" })).toBeVisible();

    if (testInfo.project.name === "mobile-chromium") {
        await page.getByRole("button", { name: "Menu" }).click();
    }
}

test("homepage renders correctly", async ({ page }, testInfo) => {
    const browserErrors = captureBrowserErrors(page);

    await mockHomepageApi(page);
    await page.goto("/index.html");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await expect(
        page.getByText(
            "Støtte til en fælles oplevelse for børnene på Hashøjskolen"
        )
    ).toBeVisible();

    await verifyNavigation(page, testInfo);
    await expectNoHorizontalOverflow(page);

    expect(browserErrors).toEqual([]);

    await expect(page).toHaveScreenshot("homepage.png", {
        fullPage: true,
    });
});

test("about page renders correctly", async ({ page }, testInfo) => {
    const browserErrors = captureBrowserErrors(page);

    await page.goto("/about.html");

    await expect(
        page.getByRole("heading", {
            level: 1,
            name: "Om Vennekredsen",
        })
    ).toBeVisible();

    await expect(
        page.getByRole("heading", {
            level: 2,
            name: "Vores værdier",
        })
    ).toBeVisible();

    await verifyNavigation(page, testInfo);
    await expectNoHorizontalOverflow(page);

    expect(browserErrors).toEqual([]);

    await expect(page).toHaveScreenshot("about.png", {
        fullPage: true,
    });
});

test("events page renders dynamic dates correctly", async ({
    page,
}, testInfo) => {
    const browserErrors = captureBrowserErrors(page);

    await mockEventsApi(page);
    await page.goto("/tilmelding.html");

    await expect(
        page.getByRole("heading", {
            level: 1,
            name: "Arrangementer",
        })
    ).toBeVisible();

    await expect(page.getByText("3. oktober 2026 kl. 14:15")).toBeVisible();

    await expect(page.getByText("4. december 2026 kl. 18:45")).toBeVisible();

    await expect(page.getByText("12. februar 2027 kl. 16:30")).toBeVisible();

    const registrationLink = page.getByRole("link", {
        name: "Gå til tilmelding",
    });

    await expect(registrationLink).toHaveAttribute(
        "href",
        "https://hashoej-if.dk/"
    );

    await verifyNavigation(page, testInfo);
    await expectNoHorizontalOverflow(page);

    expect(browserErrors).toEqual([]);

    await expect(page).toHaveScreenshot("events.png", {
        fullPage: true,
    });
});

test("application page completes support application flow", async ({
    page,
}, testInfo) => {
    const browserErrors = captureBrowserErrors(page);
    const applicationApi = await mockApplicationApi(page);

    await page.goto("/ansogning.html");

    await expect(
        page.getByRole("heading", {
            level: 1,
            name: "Ansøg om støtte",
        })
    ).toBeVisible();

    await verifyNavigation(page, testInfo);
    await expectNoHorizontalOverflow(page);

    await expect(
        page.getByText(
            "Fælles kreative aktiviteter for børnene på Hashøjskolen"
        )
    ).toBeVisible();

    await expect(page).toHaveScreenshot("application.png", {
        fullPage: true,
    });

    // Example modal
    await page
        .getByRole("button", { name: "Se eksempel på ansøgning" })
        .click();

    const exampleModal = page.locator("#exampleModal");

    await expect(exampleModal).toBeVisible();
    await expect(
        exampleModal.getByRole("heading", {
            name: "Eksempel på god ansøgning",
        })
    ).toBeVisible();

    await page.evaluate(() => {
        return new Promise(resolve => {
            const modal = $("#exampleModal");

            if (modal.hasClass("show")) {
                const element = modal.get(0);

                if (
                    !element.classList.contains("fade") ||
                    getComputedStyle(element).transitionDuration === "0s"
                ) {
                    resolve();
                    return;
                }
            }

            modal.one("shown.bs.modal", resolve);
        });
    });

    await exampleModal
        .getByRole("button", { name: "Start min ansøgning" })
        .click();

    await expect(exampleModal).toBeHidden();

    // Step 1
    await page.locator("#navn").fill("Playwright Test");
    await page.locator("#email").fill("playwright-test@invalid.local");
    await page.locator("#nextStep1").click();

    const step2 = page.locator('[data-section="2"]');
    await expect(step2).toHaveClass(/active/);

    // Step 2
    await page.locator("#belob").fill("1800");
    await page.locator("#projektTitel").fill("Fælles kreativ workshop");
    await page
        .locator("#projektFormaal")
        .fill(
            "Projektet skal skabe et kreativt fællesskab for alle skolens børn."
        );

    await page.locator("#benefit1").check();
    await page.locator("#benefit2").check();

    await page
        .locator("#konkretBrug")
        .fill(
            "Materialer til kreative aktiviteter, fælles værktøj og opbevaring."
        );

    await page
        .locator("#hvordan")
        .fill(
            "Aktiviteterne gennemføres fælles på tværs af klasser og årgange."
        );

    await page
        .locator("#langsigtet")
        .fill("Materialerne kan genbruges ved kommende fælles aktiviteter.");

    await page
        .locator("#hvorforNu")
        .fill("Projektet kan gennemføres i dette skoleår.");

    await page.locator("#nextStep2").click();

    const step3 = page.locator('[data-section="3"]');
    await expect(step3).toHaveClass(/active/);

    // Review
    await expect(page.locator("#reviewNavn")).toHaveText("Playwright Test");
    await expect(page.locator("#reviewEmail")).toHaveText(
        "playwright-test@invalid.local"
    );
    await expect(page.locator("#reviewBelob")).toHaveText("1.800");
    await expect(page.locator("#reviewTitel")).toHaveText(
        "Fælles kreativ workshop"
    );
    await expect(page.locator("#reviewFormaal")).toContainText(
        "kreativt fællesskab"
    );
    await expect(page.locator("#reviewBenefits")).toContainText(
        "Inkluderende aktiviteter"
    );
    await expect(page.locator("#reviewBenefits")).toContainText(
        "Tværgående fællesskab"
    );

    // Submit
    await page.locator("#gdprConsent").check();
    await page.locator("#submitBtn").click();

    const responseMessage = page.locator("#formResponseMessage");

    await expect(responseMessage).toContainText("Tak for din ansøgning!");
    await expect(responseMessage).toContainText(
        "playwright-test@invalid.local"
    );

    await expect.poll(() => applicationApi.submittedApplication).not.toBeNull();

    expect(applicationApi.submittedApplication).toMatchObject({
        navn: "Playwright Test",
        email: "playwright-test@invalid.local",
        belob: 1800,
    });

    expect(applicationApi.submittedApplication.beskrivelse).toContain(
        "Fælles kreativ workshop"
    );
    expect(applicationApi.submittedApplication.beskrivelse).toContain(
        "Inkluderende aktiviteter"
    );
    expect(applicationApi.submittedApplication.beskrivelse).toContain(
        "Tværgående fællesskab"
    );

    await expect(page.locator('[data-section="1"]')).toHaveClass(/active/);
    await expect(page.locator("#navn")).toHaveValue("");
    await expect(page.locator("#gdprConsent")).not.toBeChecked();

    await expectNoHorizontalOverflow(page);

    expect(browserErrors).toEqual([]);
});

test("legacy admin login redirects to member login", async ({ page }) => {
    await page.goto("/admin-login.html");
    await expect(page).toHaveURL(/member-login\.html$/);
});

test("404 page renders correctly", async ({ page }, testInfo) => {
    const browserErrors = captureBrowserErrors(page);

    await page.goto("/404.html");

    await expect(
        page.getByRole("heading", {
            level: 1,
            name: "Siden blev ikke fundet",
        })
    ).toBeVisible();

    await expect(
        page.getByRole("link", {
            name: "Tilbage til forsiden",
        })
    ).toHaveAttribute("href", "index.html");

    await verifyNavigation(page, testInfo);
    await expectNoHorizontalOverflow(page);

    await expect(page).toHaveScreenshot("404.png", {
        fullPage: true,
    });

    expect(browserErrors).toEqual([]);
});