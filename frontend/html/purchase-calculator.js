/* global XLSX */

const token = localStorage.getItem("authToken");

let parties = [];
let inventoryItems = [];
let configuredItems = [];
let calculatedItems = [];

const mainContent = document.getElementById("main-content");
const statusMessage = document.getElementById("statusMessage");
const partySelect = document.getElementById("partySelect");
const inventoryItemSelect = document.getElementById("inventoryItemSelect");
const configurationList = document.getElementById("configurationList");
const calculationForm = document.getElementById("calculationForm");
const addItemForm = document.getElementById("addItemForm");
const calculateButton = document.getElementById("calculateButton");
const addItemButton = document.getElementById("addItemButton");
const storeFilter = document.getElementById("storeFilter");
const categoryFilter = document.getElementById("categoryFilter");
const resultsTable = document.getElementById("resultsTable");
const resultsTitle = document.getElementById("resultsTitle");
const resultsSummary = document.getElementById("resultsSummary");
const downloadCurrentButton = document.getElementById("downloadCurrent");
const downloadStoreButton = document.getElementById("downloadStore");
const downloadCategoryButton = document.getElementById("downloadCategory");
const downloadTemplateXlsxButton = document.getElementById(
    "downloadTemplateXlsx"
);
const downloadTemplateCsvButton = document.getElementById(
    "downloadTemplateCsv"
);
const partyImportFile = document.getElementById("partyImportFile");
const configurationTab = document.getElementById("configurationTab");
const purchaseListTab = document.getElementById("purchaseListTab");
const configurationView = document.getElementById("configurationView");
const purchaseListView = document.getElementById("purchaseListView");

function setCalculatorView(view) {
    const showConfiguration = view === "configuration";
    configurationView.hidden = !showConfiguration;
    purchaseListView.hidden = showConfiguration;

    configurationTab.classList.toggle("is-active", showConfiguration);
    purchaseListTab.classList.toggle("is-active", !showConfiguration);
    configurationTab.setAttribute("aria-selected", String(showConfiguration));
    purchaseListTab.setAttribute("aria-selected", String(!showConfiguration));
    configurationTab.tabIndex = showConfiguration ? 0 : -1;
    purchaseListTab.tabIndex = showConfiguration ? -1 : 0;
}

function activateTabFromKeyboard(event) {
    const tabs = [configurationTab, purchaseListTab];
    const currentIndex = tabs.indexOf(event.currentTarget);
    let nextIndex;

    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const direction = event.key === "ArrowRight" ? 1 : -1;
        nextIndex = (currentIndex + direction + tabs.length) % tabs.length;
    } else if (event.key === "Home") {
        nextIndex = 0;
    } else if (event.key === "End") {
        nextIndex = tabs.length - 1;
    } else {
        return;
    }

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setCalculatorView(
        nextTab === configurationTab ? "configuration" : "purchases"
    );
    nextTab.focus();
}

function redirectToLogin() {
    localStorage.removeItem("authToken");
    window.location.href = "member-login.html";
}

function setStatus(message, state = "neutral") {
    statusMessage.textContent = message;
    statusMessage.dataset.state = state;
}

async function apiRequest(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });

    if (response.status === 401) {
        redirectToLogin();
        throw new Error("Sessionen er udløbet");
    }

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(
            payload.message || "Handlingen kunne ikke gennemføres."
        );
    }
    return payload;
}

const PARTY_TEMPLATE_HEADERS = [
    "name",
    "category",
    "unit",
    "default_store",
    "per_adult_quantity",
    "per_child_quantity",
    "factor",
    "active",
];

const PARTY_TEMPLATE_EXAMPLE = [
    "Pepsi Max",
    "Drikkevarer",
    "liter",
    "Dagrofa",
    0.5,
    0.3,
    1.1,
    true,
];

function templateRows() {
    return [PARTY_TEMPLATE_HEADERS, PARTY_TEMPLATE_EXAMPLE];
}

function downloadPartyTemplateXlsx() {
    if (typeof XLSX === "undefined") {
        setStatus("Spreadsheet-biblioteket kunne ikke indlæses.", "error");
        return;
    }
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(templateRows());
    XLSX.utils.book_append_sheet(workbook, sheet, "festkonfiguration");
    XLSX.writeFile(workbook, "Vennekredsen_festkonfiguration_template.xlsx");
}

function downloadPartyTemplateCsv() {
    const csv = templateRows()
        .map(row =>
            row
                .map(value => {
                    const text = String(value);
                    return `"${text.replaceAll('"', '""')}"`;
                })
                .join(",")
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Vennekredsen_festkonfiguration_template.csv";
    link.click();
    URL.revokeObjectURL(url);
}

function normalizeImportedRow(row) {
    const normalized = {};
    PARTY_TEMPLATE_HEADERS.forEach((header, index) => {
        normalized[header] = row[index];
    });

    const activeValue = normalized.active;
    if (typeof activeValue !== "boolean") {
        const text = String(activeValue ?? "")
            .trim()
            .toLocaleLowerCase("da-DK");
        if (["true", "1", "ja", "yes"].includes(text)) {
            normalized.active = true;
        } else if (["false", "0", "nej", "no"].includes(text)) {
            normalized.active = false;
        }
    }

    return normalized;
}

function rowsToImportItems(rows) {
    if (!Array.isArray(rows) || rows.length < 2) {
        return [];
    }
    const headers = rows[0].map(value => String(value || "").trim());
    if (
        PARTY_TEMPLATE_HEADERS.some(
            (header, index) => headers[index] !== header
        )
    ) {
        throw new Error(
            "Filen matcher ikke Vennekredsens festkonfiguration-template."
        );
    }

    return rows
        .slice(1)
        .filter(row => row.some(value => String(value ?? "").trim() !== ""))
        .map(normalizeImportedRow);
}

function parseCsv(text) {
    const lines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
    return lines.map(line => {
        const values = [];
        let current = "";
        let quoted = false;
        for (let index = 0; index < line.length; index += 1) {
            const character = line[index];
            const next = line[index + 1];
            if (character === '"' && quoted && next === '"') {
                current += '"';
                index += 1;
            } else if (character === '"') {
                quoted = !quoted;
            } else if (character === "," && !quoted) {
                values.push(current);
                current = "";
            } else {
                current += character;
            }
        }
        values.push(current);
        return values;
    });
}

async function importPartyConfiguration(file) {
    if (!partySelect.value) {
        throw new Error("Vælg en festtype før import.");
    }

    let rows;
    if (file.name.toLocaleLowerCase("da-DK").endsWith(".csv")) {
        rows = parseCsv(await file.text());
    } else {
        if (typeof XLSX === "undefined") {
            throw new Error("Spreadsheet-biblioteket kunne ikke indlæses.");
        }
        const workbook = XLSX.read(await file.arrayBuffer(), {
            cellDates: true,
        });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    }

    const items = rowsToImportItems(rows);
    if (items.length === 0) {
        throw new Error("Importfilen indeholder ingen varer.");
    }

    const result = await apiRequest(
        `/api/purchase-calculator/parties/${partySelect.value}/import`,
        {
            method: "POST",
            body: JSON.stringify({ items }),
        }
    );

    await Promise.all([loadInventory(), loadPartyConfiguration()]);
    clearCalculation();
    setStatus(
        `Import færdig: ${result.created_inventory_items} nye lagervarer, ${result.matched_inventory_items} eksisterende lagervarer, ${result.created_party_items} nye festvarer og ${result.updated_party_items} opdaterede festvarer.`,
        "success"
    );
}

function formatQuantity(value) {
    return Number(value).toLocaleString("da-DK", {
        maximumFractionDigits: 2,
    });
}

function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), "da")
    );
}

function populateSelect(select, values, placeholder) {
    const previous = select.value;
    select.replaceChildren();
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = placeholder;
    select.append(defaultOption);

    values.forEach(({ value, label }) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        select.append(option);
    });

    if ([...select.options].some(option => option.value === previous)) {
        select.value = previous;
    }
}

function renderPartyOptions() {
    populateSelect(
        partySelect,
        parties.map(party => ({ value: party.key, label: party.name })),
        "Vælg festtype"
    );
    partySelect.disabled = false;
    calculateButton.disabled = !partySelect.value;
}

function renderInventoryOptions() {
    const configuredActiveIds = new Set(
        configuredItems
            .filter(item => item.active)
            .map(item => item.inventory_item_id)
    );
    const available = inventoryItems.filter(
        item => item.active && !configuredActiveIds.has(item.id)
    );

    populateSelect(
        inventoryItemSelect,
        available.map(item => ({
            value: String(item.id),
            label: `${item.name} · ${item.category} · ${item.unit}`,
        })),
        available.length ? "Vælg lagervare" : "Ingen ledige lagervarer"
    );
    inventoryItemSelect.disabled = !partySelect.value || available.length === 0;
    addItemButton.disabled = inventoryItemSelect.disabled;
}

function makeNumberInput(value, label, min = "0") {
    const input = document.createElement("input");
    input.type = "number";
    input.min = min;
    input.step = "0.01";
    input.value = value;
    input.setAttribute("aria-label", label);
    return input;
}

function renderConfiguration() {
    configurationList.replaceChildren();

    const visible = configuredItems.filter(
        item => item.active || !item.inventory_active
    );

    if (visible.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Ingen varer er tilføjet til denne festtype endnu.";
        configurationList.append(empty);
        renderInventoryOptions();
        return;
    }

    visible.forEach(item => {
        const card = document.createElement("article");
        card.className = "configuration-card";

        const identity = document.createElement("div");
        identity.className = "configuration-identity";
        const heading = document.createElement("h3");
        heading.textContent = item.name;
        const meta = document.createElement("p");
        meta.textContent = `${item.category} · ${item.unit} · ${item.default_store || "Ingen butik"}`;
        identity.append(heading, meta);

        if (!item.inventory_active) {
            const archived = document.createElement("strong");
            archived.className = "archived-badge";
            archived.textContent = "Arkiveret i Lager";
            identity.append(archived);
        }

        const fields = document.createElement("div");
        fields.className = "configuration-values";

        const adultLabel = document.createElement("label");
        adultLabel.textContent = "Pr. voksen";
        const adult = makeNumberInput(
            item.per_adult_quantity,
            `Pr. voksen for ${item.name}`
        );
        adultLabel.append(adult);

        const childLabel = document.createElement("label");
        childLabel.textContent = "Pr. barn";
        const child = makeNumberInput(
            item.per_child_quantity,
            `Pr. barn for ${item.name}`
        );
        childLabel.append(child);

        const factorLabel = document.createElement("label");
        factorLabel.textContent = "Faktor";
        const factor = makeNumberInput(
            item.factor,
            `Faktor for ${item.name}`,
            "0.01"
        );
        factorLabel.append(factor);

        fields.append(adultLabel, childLabel, factorLabel);

        const actions = document.createElement("div");
        actions.className = "configuration-actions";

        const save = document.createElement("button");
        save.type = "button";
        save.className = "secondary-action";
        save.textContent = "Gem";
        save.disabled = !item.inventory_active;
        save.addEventListener("click", async () => {
            save.disabled = true;
            try {
                await apiRequest(
                    `/api/purchase-calculator/parties/${partySelect.value}/items/${item.inventory_item_id}`,
                    {
                        method: "PATCH",
                        body: JSON.stringify({
                            per_adult_quantity: adult.value,
                            per_child_quantity: child.value,
                            factor: factor.value,
                            active: true,
                        }),
                    }
                );
                await loadPartyConfiguration();
                setStatus(`${item.name} er opdateret.`, "success");
            } catch (error) {
                setStatus(error.message, "error");
            } finally {
                save.disabled = false;
            }
        });

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "danger-action";
        remove.textContent = "Fjern fra fest";
        remove.addEventListener("click", async () => {
            remove.disabled = true;
            try {
                await apiRequest(
                    `/api/purchase-calculator/parties/${partySelect.value}/items/${item.inventory_item_id}`,
                    { method: "DELETE" }
                );
                await loadPartyConfiguration();
                clearCalculation();
                setStatus(
                    `${item.name} er fjernet fra festkonfigurationen.`,
                    "success"
                );
            } catch (error) {
                setStatus(error.message, "error");
                remove.disabled = false;
            }
        });

        actions.append(save, remove);
        card.append(identity, fields, actions);
        configurationList.append(card);
    });

    renderInventoryOptions();
}

async function loadInventory() {
    const inventoryPayload = await apiRequest("/api/inventory/items");
    inventoryItems = inventoryPayload.items || [];
    renderInventoryOptions();
}

async function loadPartyConfiguration() {
    if (!partySelect.value) {
        configuredItems = [];
        renderConfiguration();
        return;
    }

    const payload = await apiRequest(
        `/api/purchase-calculator/parties/${partySelect.value}`
    );
    configuredItems = payload.items || [];
    renderConfiguration();
}

async function addInventoryItem(event) {
    event.preventDefault();
    if (!partySelect.value || !inventoryItemSelect.value) return;

    addItemButton.disabled = true;
    try {
        await apiRequest(
            `/api/purchase-calculator/parties/${partySelect.value}/items`,
            {
                method: "POST",
                body: JSON.stringify({
                    inventory_item_id: Number(inventoryItemSelect.value),
                    per_adult_quantity:
                        document.getElementById("addPerAdult").value,
                    per_child_quantity:
                        document.getElementById("addPerChild").value,
                    factor: document.getElementById("addFactor").value,
                }),
            }
        );
        addItemForm.reset();
        document.getElementById("addPerAdult").value = "0";
        document.getElementById("addPerChild").value = "0";
        document.getElementById("addFactor").value = "1";
        await loadPartyConfiguration();
        clearCalculation();
        setStatus("Varen er tilføjet til festkonfigurationen.", "success");
    } catch (error) {
        setStatus(error.message, "error");
    } finally {
        renderInventoryOptions();
    }
}

function populateResultFilters() {
    populateSelect(
        storeFilter,
        uniqueSorted(calculatedItems.map(item => item.default_store)).map(
            value => ({
                value,
                label: value,
            })
        ),
        "Alle indkøbssteder"
    );
    populateSelect(
        categoryFilter,
        uniqueSorted(calculatedItems.map(item => item.category)).map(value => ({
            value,
            label: value,
        })),
        "Alle kategorier"
    );

    const enabled = calculatedItems.length > 0;
    storeFilter.disabled = !enabled;
    categoryFilter.disabled = !enabled;
    downloadCurrentButton.disabled = !enabled;
    downloadStoreButton.disabled = !enabled;
    downloadCategoryButton.disabled = !enabled;
}

function getFilteredItems() {
    return calculatedItems.filter(item => {
        const storeMatches =
            !storeFilter.value || item.default_store === storeFilter.value;
        const categoryMatches =
            !categoryFilter.value || item.category === categoryFilter.value;
        return storeMatches && categoryMatches;
    });
}

function appendTextCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "";
    row.append(cell);
}

function renderResults() {
    const visible = getFilteredItems();
    resultsTable.replaceChildren();

    if (calculatedItems.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 7;
        cell.className = "empty-state";
        cell.textContent = "Ingen beregning er udført endnu.";
        row.append(cell);
        resultsTable.append(row);
        return;
    }

    if (visible.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 7;
        cell.className = "empty-state";
        cell.textContent = "Ingen varer matcher de valgte filtre.";
        row.append(cell);
        resultsTable.append(row);
        return;
    }

    visible.forEach(item => {
        const row = document.createElement("tr");
        appendTextCell(row, item.name);
        appendTextCell(row, item.category);
        appendTextCell(row, item.unit);
        appendTextCell(row, item.default_store || "");
        appendTextCell(row, formatQuantity(item.required_quantity));
        appendTextCell(row, formatQuantity(item.stock_quantity));

        const purchaseCell = document.createElement("td");
        const purchaseInput = document.createElement("input");
        purchaseInput.type = "number";
        purchaseInput.min = "0";
        purchaseInput.step = "0.01";
        purchaseInput.value = item.final_purchase_quantity;
        purchaseInput.className = "purchase-override";
        purchaseInput.setAttribute(
            "aria-label",
            `Endeligt køb for ${item.name}`
        );
        purchaseInput.addEventListener("change", () => {
            const value = Number(purchaseInput.value);
            if (!Number.isFinite(value) || value < 0) {
                purchaseInput.value = item.final_purchase_quantity;
                setStatus("Endeligt køb skal være 0 eller højere.", "error");
                return;
            }
            item.final_purchase_quantity = value;
        });
        purchaseCell.append(purchaseInput);
        row.append(purchaseCell);
        resultsTable.append(row);
    });
}

function clearCalculation() {
    calculatedItems = [];
    resultsTitle.textContent = "Ingen beregning endnu";
    resultsSummary.textContent =
        "Konfigurér festen og beregn for at få en indkøbsliste.";
    storeFilter.value = "";
    categoryFilter.value = "";
    populateResultFilters();
    renderResults();
}

async function calculatePurchases(event) {
    event.preventDefault();
    calculateButton.disabled = true;

    try {
        const payload = await apiRequest("/api/purchase-calculator/calculate", {
            method: "POST",
            body: JSON.stringify({
                party_key: partySelect.value,
                adults: document.getElementById("adultsInput").value,
                children: document.getElementById("childrenInput").value,
                subtract_stock:
                    document.getElementById("subtractStock").checked,
            }),
        });

        calculatedItems = (payload.items || []).map(item => ({
            ...item,
            final_purchase_quantity: item.suggested_purchase_quantity,
        }));

        resultsTitle.textContent = payload.party.name;
        resultsSummary.textContent =
            `${formatQuantity(payload.adults)} voksne · ${formatQuantity(payload.children)} børn · ` +
            (payload.subtract_stock
                ? "lager trukket fra"
                : "lager ikke trukket fra");
        populateResultFilters();
        renderResults();
        setStatus(
            calculatedItems.length
                ? `${calculatedItems.length} varer er beregnet.`
                : "Festtypen har ingen aktive varer at beregne.",
            calculatedItems.length ? "success" : "neutral"
        );
        setCalculatorView("purchases");
    } catch (error) {
        setStatus(error.message, "error");
    } finally {
        calculateButton.disabled = !partySelect.value;
    }
}

function exportRows(items, includeStore = true, includeCategory = true) {
    const headers = ["Vare", "Enhed", "Behov", "Lager", "Køb"];
    if (includeStore) headers.push("Indkøbssted");
    if (includeCategory) headers.push("Kategori");

    return [
        headers,
        ...items.map(item => {
            const row = [
                item.name,
                item.unit,
                item.required_quantity,
                item.stock_quantity,
                item.final_purchase_quantity,
            ];
            if (includeStore) row.push(item.default_store);
            if (includeCategory) row.push(item.category);
            return row;
        }),
    ];
}

function ensureSpreadsheetLibrary() {
    if (typeof XLSX === "undefined") {
        setStatus("Eksportbiblioteket kunne ikke indlæses.", "error");
        return false;
    }
    return true;
}

function safeSheetName(value, fallback) {
    const cleaned = String(value)
        .replace(/[\\/:*?"<>|]/g, "")
        .slice(0, 31);
    return cleaned || fallback;
}

function downloadCurrentView() {
    if (!ensureSpreadsheetLibrary()) return;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(exportRows(getFilteredItems())),
        "Indkob"
    );
    XLSX.writeFile(workbook, "Indkob_beregnet.xlsx");
}

function downloadGrouped(
    groupKey,
    filename,
    label,
    includeStore,
    includeCategory
) {
    if (!ensureSpreadsheetLibrary()) return;
    const workbook = XLSX.utils.book_new();
    uniqueSorted(calculatedItems.map(item => item[groupKey])).forEach(
        (value, index) => {
            const items = calculatedItems.filter(
                item => item[groupKey] === value
            );
            XLSX.utils.book_append_sheet(
                workbook,
                XLSX.utils.aoa_to_sheet(
                    exportRows(items, includeStore, includeCategory)
                ),
                safeSheetName(value, `${label}${index + 1}`)
            );
        }
    );
    XLSX.writeFile(workbook, filename);
}

async function initialize() {
    if (!token) {
        redirectToLogin();
        return;
    }

    try {
        await apiRequest("/api/me");
        const [partyPayload, inventoryPayload] = await Promise.all([
            apiRequest("/api/purchase-calculator/parties"),
            apiRequest("/api/inventory/items"),
        ]);
        parties = partyPayload.parties || [];
        inventoryItems = inventoryPayload.items || [];
        renderPartyOptions();

        if (parties.length > 0) {
            partySelect.value = parties[0].key;
            calculateButton.disabled = false;
            await loadPartyConfiguration();
        }
        mainContent.hidden = false;
        setStatus("Beregneren er klar.", "success");
    } catch (error) {
        if (error.message !== "Sessionen er udløbet") {
            setStatus(error.message, "error");
        }
    }
}

configurationTab.addEventListener("click", () =>
    setCalculatorView("configuration")
);
purchaseListTab.addEventListener("click", () => setCalculatorView("purchases"));
configurationTab.addEventListener("keydown", activateTabFromKeyboard);
purchaseListTab.addEventListener("keydown", activateTabFromKeyboard);

partySelect.addEventListener("change", async () => {
    calculateButton.disabled = !partySelect.value;
    clearCalculation();
    try {
        await loadPartyConfiguration();
        setStatus("Festkonfigurationen er indlæst.", "success");
    } catch (error) {
        setStatus(error.message, "error");
    }
});
calculationForm.addEventListener("submit", calculatePurchases);
addItemForm.addEventListener("submit", addInventoryItem);
storeFilter.addEventListener("change", renderResults);
categoryFilter.addEventListener("change", renderResults);
downloadCurrentButton.addEventListener("click", downloadCurrentView);
downloadStoreButton.addEventListener("click", () =>
    downloadGrouped(
        "default_store",
        "Indkob_efter_butik.xlsx",
        "Butik",
        false,
        true
    )
);
downloadTemplateXlsxButton.addEventListener("click", downloadPartyTemplateXlsx);
downloadTemplateCsvButton.addEventListener("click", downloadPartyTemplateCsv);
partyImportFile.addEventListener("change", async event => {
    const [file] = event.target.files;
    if (!file) return;
    try {
        setStatus(`Importerer ${file.name}...`);
        await importPartyConfiguration(file);
    } catch (error) {
        setStatus(error.message, "error");
    } finally {
        partyImportFile.value = "";
    }
});

downloadCategoryButton.addEventListener("click", () =>
    downloadGrouped(
        "category",
        "Indkob_efter_kategori.xlsx",
        "Kategori",
        true,
        false
    )
);
document
    .getElementById("logoutButton")
    .addEventListener("click", redirectToLogin);

initialize();
