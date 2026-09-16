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
const announcementText = document.querySelector("[data-site-announcement-text]");

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
    } catch {
        if (announcement) announcement.hidden = true;
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

loadSiteSettings();
loadNextEvent();
loadProjects();
