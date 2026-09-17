const { test, expect } = require("@playwright/test");

const pixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2S6sAAAAASUVORK5CYII=",
  "base64"
);

async function mockAdminArea(page) {
  let videoSettings = {
    hero_video_url: "",
    hero_video_enabled: false,
    logo_available: false,
    hero_background_available: false,
  };

  await page.route("**/api/me", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: 1,
        username: "admin",
        email: "admin@example.com",
        role: "admin",
      }),
    })
  );

  await page.route("**/api/member/resources", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        resources: [
          {
            id: "website",
            title: "Hjemmeside",
            description: "Hjemmeside",
            href: "member.html#website",
            available: true,
          },
        ],
      }),
    })
  );

  await page.route("**/api/admin/site-settings", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        settings: {
          hero_heading: "Hero",
          hero_subheading: "Undertekst",
          intro_text: "Mission",
          announcement_text: "",
          announcement_visible: false,
        },
        media: videoSettings,
      }),
    })
  );

  await page.route("**/api/admin/site-video", async route => {
    videoSettings = { ...videoSettings, ...route.request().postDataJSON() };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ media: videoSettings }),
    });
  });

  await page.route("**/api/admin/site-media/*", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        media: {
          key: route.request().url().split("/").pop(),
          filename: "upload.png",
          content_type: "image/png",
          size: pixelPng.length,
        },
      }),
    })
  );

  await page.route("**/api/site-media/*", route =>
    route.fulfill({ status: 200, contentType: "image/png", body: pixelPng })
  );

  return { getVideoSettings: () => videoSettings };
}

async function openAdminWebsite(page) {
  const state = await mockAdminArea(page);
  await page.addInitScript(() => {
    localStorage.setItem("authToken", "admin-token");
  });
  await page.goto("/member.html#website");
  return state;
}

async function mockHomepageDependencies(page, media) {
  await page.route("**/api/site-settings", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        settings: {
          hero_heading: "Dynamisk hero",
          hero_subheading: "Undertekst",
          intro_text: "Mission",
          announcement_text: "",
          announcement_visible: false,
        },
        media,
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
}

test("admin can upload logo and hero image from website settings", async ({ page }) => {
  await openAdminWebsite(page);

  await expect(page.getByRole("heading", { name: "Billeder og video" })).toBeVisible();

  await page.locator("#site-logo-file").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: pixelPng,
  });
  await page.getByRole("button", { name: "Upload logo" }).click();
  await expect(page.getByText("Billedet er gemt.")).toBeVisible();

  await page.locator("#hero-background-file").setInputFiles({
    name: "hero.png",
    mimeType: "image/png",
    buffer: pixelPng,
  });
  await page.getByRole("button", { name: "Upload hero-billede" }).click();
  await expect(page.getByText("Billedet er gemt.")).toBeVisible();
});

test("admin can configure direct hero video", async ({ page }) => {
  const state = await openAdminWebsite(page);

  await page.locator('[name="hero_video_url"]').fill("https://cdn.example.com/hero.mp4");
  await page.locator('[name="hero_video_enabled"]').check();
  await page.getByRole("button", { name: "Gem videoindstillinger" }).click();

  await expect(page.getByText("Videoindstillingerne er gemt.")).toBeVisible();
  expect(state.getVideoSettings()).toMatchObject({
    hero_video_url: "https://cdn.example.com/hero.mp4",
    hero_video_enabled: true,
  });
});

test("admin can configure Vimeo hero video", async ({ page }) => {
  const state = await openAdminWebsite(page);

  await page.locator('[name="hero_video_url"]').fill("https://vimeo.com/123456789");
  await page.locator('[name="hero_video_enabled"]').check();
  await page.getByRole("button", { name: "Gem videoindstillinger" }).click();

  await expect(page.getByText("Videoindstillingerne er gemt.")).toBeVisible();
  expect(state.getVideoSettings()).toMatchObject({
    hero_video_url: "https://vimeo.com/123456789",
    hero_video_enabled: true,
  });
  await expect(page.getByText(/Vimeo-link eller et direkte/)).toBeVisible();
});

test("homepage uses managed logo and configures direct hero video", async ({ page }) => {
  await mockHomepageDependencies(page, {
    hero_video_url: "https://cdn.example.com/hero.mp4",
    hero_video_enabled: true,
    hero_video_type: "direct",
    hero_video_embed_url: "",
    logo_available: true,
    hero_background_available: true,
  });
  await page.route("**/api/site-media/logo**", route =>
    route.fulfill({ status: 200, contentType: "image/png", body: pixelPng })
  );
  await page.route("**/api/site-media/hero-background**", route =>
    route.fulfill({ status: 200, contentType: "image/png", body: pixelPng })
  );
  await page.route("https://cdn.example.com/hero.mp4", route => route.abort());

  await page.goto("/index.html");

  await expect(page.locator(".brand-mark .site-logo")).toHaveCount(1);
  const video = page.locator(".hero-media-video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveAttribute("src", "https://cdn.example.com/hero.mp4");
  await expect(page.locator("[data-site-hero-heading]")).toHaveText("Dynamisk hero");
});

test("homepage renders Vimeo hero background", async ({ page }) => {
  const embedUrl =
    "https://player.vimeo.com/video/123456789?background=1&autoplay=1&muted=1&loop=1&autopause=0&title=0&byline=0&portrait=0";
  await mockHomepageDependencies(page, {
    hero_video_url: "https://vimeo.com/123456789",
    hero_video_enabled: true,
    hero_video_type: "vimeo",
    hero_video_embed_url: embedUrl,
    logo_available: false,
    hero_background_available: true,
  });
  await page.route("**/api/site-media/hero-background**", route =>
    route.fulfill({ status: 200, contentType: "image/png", body: pixelPng })
  );
  await page.route("https://player.vimeo.com/**", route =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<html></html>" })
  );

  await page.goto("/index.html");

  const iframe = page.locator(".hero-media-vimeo");
  await expect(iframe).toHaveCount(1);
  await expect(iframe).toHaveAttribute("src", embedUrl);
  await expect(iframe).toHaveAttribute("allow", /autoplay/);
  await expect(page.locator(".hero-media-video")).toHaveCount(0);
  await expect(page.locator("[data-site-hero-heading]")).toHaveText("Dynamisk hero");
});

test("homepage keeps V logo fallback when no managed logo exists", async ({ page }) => {
  let mediaRequests = 0;

  await page.route("**/api/site-settings", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        settings: {},
        media: {
          logo_available: false,
          hero_background_available: false,
        },
      }),
    })
  );
  await page.route("**/api/site-media/**", route => {
    mediaRequests += 1;
    return route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
  });
  await page.route("**/api/events", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
  );
  await page.route("**/api/approved-projects", route =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
  );

  await page.goto("/index.html");
  await expect(page.locator(".brand-mark")).toHaveText("V");
  expect(mediaRequests).toBe(0);
});
