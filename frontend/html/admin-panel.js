const token = localStorage.getItem("adminToken");

if (!token) {
    window.location.href = "admin-login.html";
}

const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
};

let applications = [];
let users = [];

function showMessage(message, type = "success") {
    const element = document.getElementById("admin-message");
    element.textContent = message;
    element.className = `admin-message ${type}`;
    element.hidden = false;
    window.setTimeout(() => {
        element.hidden = true;
    }, 5000);
}

function handleAuthFailure(response) {
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("adminToken");
        window.location.href = "admin-login.html";
        return true;
    }
    return false;
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...authHeaders,
            ...(options.headers || {}),
        },
    });

    if (handleAuthFailure(response)) {
        throw new Error("Sessionen er udløbet");
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(payload.message || `HTTP ${response.status}`);
    }
    return payload;
}

function setActiveTab(tabName) {
    document.querySelectorAll("[data-admin-tab]").forEach(button => {
        button.classList.toggle("active", button.dataset.adminTab === tabName);
    });
    document.querySelectorAll("[data-admin-panel]").forEach(panel => {
        panel.hidden = panel.dataset.adminPanel !== tabName;
    });
}

function renderApplications() {
    const container = document.getElementById("applications-list");
    const status = document.getElementById("application-status-filter").value;
    const query = document
        .getElementById("application-search")
        .value.trim()
        .toLocaleLowerCase("da");

    const visible = applications.filter(application => {
        const statusMatch = status === "all" || application.status === status;
        const haystack =
            `${application.navn} ${application.email} ${application.beskrivelse}`.toLocaleLowerCase(
                "da"
            );
        return statusMatch && (!query || haystack.includes(query));
    });

    container.replaceChildren();
    if (visible.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Ingen ansøgninger matcher filtrene.";
        container.append(empty);
        return;
    }

    visible.forEach(application => {
        const card = document.createElement("article");
        card.className = "admin-card application-card";

        const heading = document.createElement("h3");
        heading.textContent = application.navn;

        const meta = document.createElement("p");
        meta.className = "admin-meta";
        meta.textContent = `${application.email} · ${Number(application.belob).toLocaleString("da-DK")} kr.`;

        const description = document.createElement("p");
        description.textContent = application.beskrivelse;

        const controls = document.createElement("div");
        controls.className = "inline-controls";

        const select = document.createElement("select");
        select.setAttribute("aria-label", `Status for ${application.navn}`);
        [
            ["pending", "Afventer"],
            ["approved", "Godkendt"],
            ["rejected", "Afvist"],
        ].forEach(([value, label]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            option.selected = application.status === value;
            select.append(option);
        });
        select.addEventListener("change", async () => {
            try {
                await apiRequest(
                    `/api/admin/ansoegning/${application.id}/status`,
                    {
                        method: "PUT",
                        body: JSON.stringify({ status: select.value }),
                    }
                );
                application.status = select.value;
                renderApplications();
                showMessage("Ansøgningsstatus er opdateret.");
            } catch (error) {
                select.value = application.status;
                showMessage(error.message, "error");
            }
        });
        controls.append(select);

        if (application.status === "rejected") {
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "button danger secondary";
            deleteButton.textContent = "Slet afvist";
            deleteButton.addEventListener("click", async () => {
                if (
                    !window.confirm(
                        `Slet den afviste ansøgning fra ${application.navn}?`
                    )
                )
                    return;
                try {
                    await apiRequest(
                        `/api/admin/ansoegning/${application.id}`,
                        {
                            method: "DELETE",
                        }
                    );
                    applications = applications.filter(
                        item => item.id !== application.id
                    );
                    renderApplications();
                    showMessage("Den afviste ansøgning er slettet.");
                } catch (error) {
                    showMessage(error.message, "error");
                }
            });
            controls.append(deleteButton);
        }

        card.append(heading, meta, description, controls);
        container.append(card);
    });
}

async function loadApplications() {
    applications = await apiRequest("/api/admin/ansoegninger");
    renderApplications();
}

function renderUsers() {
    const container = document.getElementById("users-list");
    container.replaceChildren();

    users.forEach(user => {
        const row = document.createElement("article");
        row.className = "admin-card user-card";

        const identity = document.createElement("div");
        const heading = document.createElement("h3");
        heading.textContent = user.username;
        const meta = document.createElement("p");
        meta.className = "admin-meta";
        meta.textContent = user.email;
        identity.append(heading, meta);

        const role = document.createElement("select");
        role.setAttribute("aria-label", `Rolle for ${user.username}`);
        [
            ["member", "Medlem"],
            ["admin", "Administrator"],
        ].forEach(([value, label]) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            option.selected = user.role === value;
            role.append(option);
        });

        const activeLabel = document.createElement("label");
        activeLabel.className = "toggle-row";
        const active = document.createElement("input");
        active.type = "checkbox";
        active.checked = user.is_active;
        active.setAttribute("aria-label", `Aktiv status for ${user.username}`);
        const activeText = document.createElement("span");
        activeText.textContent = user.is_active ? "Aktiv" : "Inaktiv";
        activeLabel.append(active, activeText);

        const save = document.createElement("button");
        save.type = "button";
        save.className = "button secondary";
        save.textContent = "Gem bruger";
        save.addEventListener("click", async () => {
            save.disabled = true;
            try {
                const payload = await apiRequest(
                    `/api/admin/users/${user.id}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({
                            role: role.value,
                            is_active: active.checked,
                        }),
                    }
                );
                Object.assign(user, payload.user);
                renderUsers();
                showMessage(`Brugeren ${user.username} er opdateret.`);
            } catch (error) {
                role.value = user.role;
                active.checked = user.is_active;
                activeText.textContent = user.is_active ? "Aktiv" : "Inaktiv";
                showMessage(error.message, "error");
            } finally {
                save.disabled = false;
            }
        });

        active.addEventListener("change", () => {
            activeText.textContent = active.checked ? "Aktiv" : "Inaktiv";
        });

        const controls = document.createElement("div");
        controls.className = "user-controls";
        controls.append(role, activeLabel, save);
        row.append(identity, controls);
        container.append(row);
    });
}

async function loadUsers() {
    users = await apiRequest("/api/admin/users");
    renderUsers();
}

async function createUser(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const password = form.elements.password.value;
    const confirmPassword = form.elements.confirmPassword.value;
    if (password !== confirmPassword) {
        showMessage("Adgangskoderne er ikke ens.", "error");
        return;
    }

    try {
        await apiRequest("/api/admin/users", {
            method: "POST",
            body: JSON.stringify({
                username: form.elements.username.value.trim(),
                email: form.elements.email.value.trim(),
                role: form.elements.role.value,
                password,
            }),
        });
        form.reset();
        await loadUsers();
        showMessage("Brugeren er oprettet.");
    } catch (error) {
        showMessage(error.message, "error");
    }
}

async function changePassword(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (
        form.elements.newPassword.value !==
        form.elements.confirmNewPassword.value
    ) {
        showMessage("De nye adgangskoder er ikke ens.", "error");
        return;
    }

    try {
        await apiRequest("/api/admin/change-password", {
            method: "PUT",
            body: JSON.stringify({
                currentPassword: form.elements.currentPassword.value,
                newPassword: form.elements.newPassword.value,
            }),
        });
        form.reset();
        showMessage("Adgangskoden er ændret.");
    } catch (error) {
        showMessage(error.message, "error");
    }
}

function fillEventForm(events) {
    Object.entries(events).forEach(([key, value]) => {
        const input = document.querySelector(`[name="${key}"]`);
        if (input && value) input.value = value.slice(0, 16);
    });
}

async function loadEvents() {
    const payload = await apiRequest("/api/admin/events");
    fillEventForm(payload.events || {});
}

async function saveEvents(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
        const payload = await apiRequest("/api/admin/events", {
            method: "PUT",
            body: JSON.stringify({
                sommerfest: form.elements.sommerfest.value,
                julefest: form.elements.julefest.value,
                fastelavn: form.elements.fastelavn.value,
            }),
        });
        fillEventForm(payload.events || {});
        showMessage("Arrangementsdatoerne er gemt.");
    } catch (error) {
        showMessage(error.message, "error");
    }
}

function fillSiteSettings(settings) {
    const form = document.getElementById("site-settings-form");
    form.elements.hero_heading.value = settings.hero_heading || "";
    form.elements.hero_subheading.value = settings.hero_subheading || "";
    form.elements.intro_text.value = settings.intro_text || "";
    form.elements.announcement_text.value = settings.announcement_text || "";
    form.elements.announcement_visible.checked = Boolean(
        settings.announcement_visible
    );
}

async function loadSiteSettings() {
    const payload = await apiRequest("/api/admin/site-settings");
    fillSiteSettings(payload.settings || {});
}

async function saveSiteSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
        const payload = await apiRequest("/api/admin/site-settings", {
            method: "PUT",
            body: JSON.stringify({
                hero_heading: form.elements.hero_heading.value,
                hero_subheading: form.elements.hero_subheading.value,
                intro_text: form.elements.intro_text.value,
                announcement_text: form.elements.announcement_text.value,
                announcement_visible:
                    form.elements.announcement_visible.checked,
            }),
        });
        fillSiteSettings(payload.settings);
        showMessage("Hjemmesidens indhold er gemt.");
    } catch (error) {
        showMessage(error.message, "error");
    }
}

function logout() {
    localStorage.removeItem("adminToken");
    window.location.href = "admin-login.html";
}

async function initialize() {
    document.querySelectorAll("[data-admin-tab]").forEach(button => {
        button.addEventListener("click", () =>
            setActiveTab(button.dataset.adminTab)
        );
    });
    document.getElementById("logout-button").addEventListener("click", logout);
    document
        .getElementById("application-status-filter")
        .addEventListener("change", renderApplications);
    document
        .getElementById("application-search")
        .addEventListener("input", renderApplications);
    document
        .getElementById("create-user-form")
        .addEventListener("submit", createUser);
    document
        .getElementById("change-password-form")
        .addEventListener("submit", changePassword);
    document
        .getElementById("event-form")
        .addEventListener("submit", saveEvents);
    document
        .getElementById("site-settings-form")
        .addEventListener("submit", saveSiteSettings);

    try {
        await Promise.all([
            loadApplications(),
            loadUsers(),
            loadEvents(),
            loadSiteSettings(),
        ]);
    } catch (error) {
        showMessage(error.message, "error");
    }
}

initialize();
