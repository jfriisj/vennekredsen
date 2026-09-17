const eventNames = {
    sommerfest: "Sommerfest",
    julefest: "Julefest",
    fastelavn: "Fastelavn",
};

const navToggle = document.querySelector("[data-nav-toggle]");
const navLinks = document.querySelector("[data-nav-links]");
const eventTitle = document.querySelector("[data-next-event-title]");
const eventDate = document.querySelector("[data-next-event-date]");
const eventStatus = document.querySelector("[data-next-event-status]");
const projectsContainer = document.querySelector("[data-projects]");
const currentYear = document.querySelector("[data-current-year]");
const heroHeading = document.querySelector("[data-site-hero-heading]");
const heroSubheading = document.querySelector("[data-site-hero-subheading]");
const introText = document.querySelector("[data-site-intro]");
const announcement = document.querySelector("[data-site-announcement]");
const announcementText = document.querySelector(
    "[data-site-announcement-text]"
);

function loadManagedMediaStyles() {
    if (document.querySelector('link[href="site-media.css"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "site-media.css";
    document.head.append(link);
}

function hasManagedMediaStyles(mediaSettings = {}) {
    return Boolean(
        mediaSettings.logo_available ||
        mediaSettings.hero_background_available ||
        mediaSettings.site_background_available ||
        mediaSettings.hero_video_enabled
    );
}

function applyManagedSiteBackground(mediaSettings = {}) {
    const hasBackground = Boolean(mediaSettings.site_background_available);
    document.body?.classList.toggle(
        "has-managed-site-background",
        hasBackground
    );
}

function loadSiteLogo(mediaSettings = {}) {
    if (!mediaSettings.logo_available) return;

    document.querySelectorAll(".brand-mark").forEach(mark => {
        const image = new Image();
        image.className = "site-logo";
        image.alt = "";
        image.onload = () => {
            mark.replaceChildren(image);
            mark.classList.add("has-site-logo");
        };
        image.src = `/api/site-media/logo?v=${Date.now()}`;
    });
}

function prepareHeroMedia(mediaSettings = {}) {
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;
    const hasBackground = Boolean(mediaSettings.hero_background_available);
    const shouldPlay = Boolean(
        mediaSettings.hero_video_enabled &&
        mediaSettings.hero_video_url &&
        !reducedMotion
    );
    const hasManagedMedia = hasBackground || shouldPlay;

    hero.classList.toggle("has-managed-media", hasManagedMedia);
    hero.classList.toggle("has-managed-background", hasBackground);

    const existingVideo = hero.querySelector(".hero-media-video");
    const existingVimeo = hero.querySelector(".hero-media-vimeo");
    const existingOverlay = hero.querySelector(".hero-media-overlay");

    if (!hasManagedMedia) {
        if (existingVideo) existingVideo.remove();
        if (existingVimeo) existingVimeo.remove();
        if (existingOverlay) existingOverlay.remove();
        return;
    }

    let overlay = existingOverlay;
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "hero-media-overlay";
        overlay.setAttribute("aria-hidden", "true");
        hero.prepend(overlay);
    }

    if (!shouldPlay) {
        if (existingVideo) existingVideo.remove();
        if (existingVimeo) existingVimeo.remove();
        return;
    }

    const videoType =
        mediaSettings.hero_video_type ||
        (mediaSettings.hero_video_embed_url ? "vimeo" : "direct");

    if (videoType === "vimeo") {
        if (existingVideo) existingVideo.remove();
        if (!mediaSettings.hero_video_embed_url) {
            if (existingVimeo) existingVimeo.remove();
            return;
        }

        const iframe = existingVimeo || document.createElement("iframe");
        iframe.className = "hero-media-vimeo";
        iframe.src = mediaSettings.hero_video_embed_url;
        iframe.title = "Dekorativ hero-video";
        iframe.tabIndex = -1;
        iframe.loading = "eager";
        iframe.allow = "autoplay; fullscreen; picture-in-picture";
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        iframe.setAttribute("aria-hidden", "true");
        iframe.hidden = false;

        if (!existingVimeo) hero.prepend(iframe);
        return;
    }

    if (existingVimeo) existingVimeo.remove();
    if (videoType !== "direct") {
        if (existingVideo) existingVideo.remove();
        return;
    }

    const video = existingVideo || document.createElement("video");
    video.className = "hero-media-video";
    video.muted = true;
    video.autoplay = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute("aria-hidden", "true");
    video.poster = hasBackground
        ? "/api/site-media/hero-background"
        : "skole.png";
    video.src = mediaSettings.hero_video_url;
    video.hidden = false;
    video.addEventListener("error", () => {
        video.hidden = true;
    });

    if (!existingVideo) hero.prepend(video);
    video.play().catch(() => {
        video.hidden = true;
    });
}

if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("is-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
    });
}

if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
}

function formatDate(value) {
    return new Intl.DateTimeFormat("da-DK", {
        dateStyle: "long",
        timeStyle: "short",
    }).format(value);
}

async function loadSiteSettings() {
    try {
        const response = await fetch("/api/site-settings");
        if (!response.ok) throw new Error("Indhold kunne ikke hentes");

        const payload = await response.json();
        const settings = payload.settings || {};
        const mediaSettings = payload.media || {};

        if (heroHeading && settings.hero_heading) {
            heroHeading.textContent = settings.hero_heading;
        }
        if (heroSubheading && settings.hero_subheading) {
            heroSubheading.textContent = settings.hero_subheading;
        }
        if (introText && settings.intro_text) {
            introText.textContent = settings.intro_text;
        }

        if (announcement && announcementText) {
            const visible = Boolean(
                settings.announcement_visible && settings.announcement_text
            );
            announcement.hidden = !visible;
            announcementText.textContent = visible
                ? settings.announcement_text
                : "";
        }

        if (hasManagedMediaStyles(mediaSettings)) {
            loadManagedMediaStyles();
        }
        applyManagedSiteBackground(mediaSettings);
        loadSiteLogo(mediaSettings);
        prepareHeroMedia(mediaSettings);
    } catch {
        if (announcement) announcement.hidden = true;
        applyManagedSiteBackground({});
        prepareHeroMedia({});
    }
}

async function loadNextEvent() {
    if (!eventTitle || !eventDate || !eventStatus) return;

    try {
        const response = await fetch("/api/events");
        if (!response.ok) throw new Error("Events kunne ikke hentes");

        const payload = await response.json();
        const now = new Date();
        const events = Object.entries(payload.events || {})
            .map(([key, rawDate]) => ({
                key,
                date: new Date(rawDate),
            }))
            .filter(event => !Number.isNaN(event.date.getTime()))
            .sort((a, b) => a.date - b.date);

        const nextEvent = events.find(event => event.date >= now) || events[0];

        if (!nextEvent) {
            eventTitle.textContent = "Nyt arrangement på vej";
            eventDate.textContent = "Dato offentliggøres senere";
            eventStatus.textContent =
                "Hold øje med siden for næste arrangement.";
            return;
        }

        eventTitle.textContent =
            eventNames[nextEvent.key] || "Kommende arrangement";
        eventDate.textContent = formatDate(nextEvent.date);
        eventStatus.textContent =
            nextEvent.date >= now
                ? "Vi glæder os til at samle børnene til endnu et arrangement."
                : "Senest registrerede arrangement.";
    } catch {
        eventTitle.textContent = "Kommende arrangement";
        eventDate.textContent = "Kunne ikke hente datoen lige nu";
        eventStatus.textContent = "Prøv igen senere eller se arrangementsiden.";
    }
}

function createProjectCard(project) {
    const article = document.createElement("article");
    article.className = "card-panel project-card";

    const amount = document.createElement("span");
    amount.className = "project-amount";
    amount.textContent = `${Number(project.belob || 0).toLocaleString(
        "da-DK"
    )} kr.`;

    const heading = document.createElement("h3");
    heading.textContent = project.beskrivelse || "Støttet projekt";

    const meta = document.createElement("p");
    if (project.godkendt_dato) {
        const approvedDate = new Intl.DateTimeFormat("da-DK", {
            dateStyle: "medium",
        }).format(new Date(project.godkendt_dato));
        meta.textContent = `Godkendt ${approvedDate}`;
    } else {
        meta.textContent = "Godkendt af Vennekredsen";
    }

    article.append(amount, heading, meta);
    return article;
}

async function loadProjects() {
    if (!projectsContainer) return;

    try {
        const response = await fetch("/api/approved-projects");
        if (!response.ok) throw new Error("Projekter kunne ikke hentes");

        const projects = await response.json();
        projectsContainer.replaceChildren();

        if (!Array.isArray(projects) || projects.length === 0) {
            const emptyState = document.createElement("p");
            emptyState.className = "empty-state";
            emptyState.textContent =
                "Der er endnu ingen offentliggjorte støttede projekter. Nye projekter vises her, når de er godkendt.";
            projectsContainer.append(emptyState);
            return;
        }

        projects
            .slice()
            .sort((a, b) =>
                String(b.godkendt_dato || "").localeCompare(
                    String(a.godkendt_dato || "")
                )
            )
            .slice(0, 3)
            .forEach(project =>
                projectsContainer.append(createProjectCard(project))
            );
    } catch {
        const emptyState = document.createElement("p");
        emptyState.className = "empty-state";
        emptyState.textContent =
            "De støttede projekter kunne ikke hentes lige nu.";
        projectsContainer.replaceChildren(emptyState);
    }
}

prepareHeroMedia({});
loadSiteSettings();
loadNextEvent();
loadProjects();

if (document.getElementById("site-settings-form")) {
    loadManagedMediaStyles();
    import("./site-media-admin.js");
}
