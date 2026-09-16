const token = localStorage.getItem("authToken");
const mainContent = document.getElementById("main-content");
const inventoryStatus = document.getElementById("inventoryStatus");
const inventoryList = document.getElementById("inventoryList");
const searchInput = document.getElementById("searchInput");
const stockFilter = document.getElementById("stockFilter");
const categoryFilter = document.getElementById("categoryFilter");
const saveCountsButton = document.getElementById("saveCountsButton");
const importFile = document.getElementById("importFile");
const itemDialog = document.getElementById("itemDialog");
const itemForm = document.getElementById("itemForm");
const itemDialogTitle = document.getElementById("itemDialogTitle");
const itemId = document.getElementById("itemId");
const itemName = document.getElementById("itemName");
const itemCategory = document.getElementById("itemCategory");
const itemUnit = document.getElementById("itemUnit");
const itemStore = document.getElementById("itemStore");
const itemStock = document.getElementById("itemStock");
const itemNote = document.getElementById("itemNote");
const initialStockField = document.getElementById("initialStockField");
const archiveItemButton = document.getElementById("archiveItemButton");
const formStatus = document.getElementById("formStatus");

let inventoryItems = [];
const pendingCounts = new Map();

function redirectToLogin() {
    localStorage.removeItem("authToken");
    window.location.href = "member-login.html";
}

async function authenticatedFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${token}`);

    if (options.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        redirectToLogin();
        throw new Error("Unauthorized");
    }
    return response;
}

async function verifyAccess() {
    if (!token) {
        redirectToLogin();
        return false;
    }

    try {
        const response = await authenticatedFetch("/api/me");
        if (!response.ok) {
            redirectToLogin();
            return false;
        }
        mainContent.hidden = false;
        return true;
    } catch (error) {
        if (error.message !== "Unauthorized") {
            console.error("Inventory authentication failed:", error);
        }
        redirectToLogin();
        return false;
    }
}

function setStatus(message) {
    inventoryStatus.textContent = message;
}

function formatQuantity(value) {
    const number = Number(value);
    if (Number.isInteger(number)) {
        return String(number);
    }
    return number.toLocaleString("da-DK", { maximumFractionDigits: 2 });
}

function formatCountedAt(value) {
    if (!value) {
        return "Ikke optalt endnu";
    }
    const date = new Date(value);
    return `Senest optalt ${date.toLocaleString("da-DK")}`;
}

function populateCategories() {
    const previous = categoryFilter.value;
    const categories = [...new Set(inventoryItems.map(item => item.category))].sort(
        (a, b) => a.localeCompare(b, "da")
    );

    categoryFilter.replaceChildren();
    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "Alle kategorier";
    categoryFilter.appendChild(allOption);

    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });

    if (categories.includes(previous)) {
        categoryFilter.value = previous;
    }
}

function filteredItems() {
    const query = searchInput.value.trim().toLocaleLowerCase("da-DK");
    const stock = stockFilter.value;
    const category = categoryFilter.value;

    return inventoryItems.filter(item => {
        const matchesSearch =
            !query || item.name.toLocaleLowerCase("da-DK").includes(query);
        const matchesCategory = !category || item.category === category;
        const quantity = pendingCounts.has(item.id)
            ? pendingCounts.get(item.id)
            : item.stock_quantity;
        const matchesStock =
            stock === "all" ||
            (stock === "in_stock" && quantity > 0) ||
            (stock === "zero" && quantity === 0);
        return matchesSearch && matchesCategory && matchesStock;
    });
}

function markCount(item, input, nextValue) {
    const value = Math.max(0, Number(nextValue) || 0);
    input.value = value;
    input.dataset.dirty = "true";
    pendingCounts.set(item.id, value);
    saveCountsButton.disabled = false;
}

function createInventoryCard(item) {
    const card = document.createElement("article");
    card.className = "inventory-card";
    card.dataset.itemId = item.id;

    const header = document.createElement("div");
    header.className = "inventory-card-header";

    const headingGroup = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = item.name;
    const meta = document.createElement("p");
    meta.className = "inventory-meta";
    meta.textContent = [item.category, item.unit, item.default_store]
        .filter(Boolean)
        .join(" · ");
    headingGroup.append(title, meta);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "secondary-action";
    editButton.textContent = "Redigér";
    editButton.addEventListener("click", () => openEditDialog(item));
    header.append(headingGroup, editButton);

    const stockControl = document.createElement("div");
    stockControl.className = "stock-control";
    const stockLabel = document.createElement("span");
    stockLabel.textContent = `På lager (${item.unit})`;

    const stepper = document.createElement("div");
    stepper.className = "stock-stepper";

    const minusButton = document.createElement("button");
    minusButton.type = "button";
    minusButton.setAttribute("aria-label", `Træk én fra ${item.name}`);
    minusButton.textContent = "−";

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "any";
    input.inputMode = "decimal";
    input.setAttribute("aria-label", `Lagerantal for ${item.name}`);
    input.value = pendingCounts.has(item.id)
        ? pendingCounts.get(item.id)
        : item.stock_quantity;
    if (pendingCounts.has(item.id)) {
        input.dataset.dirty = "true";
    }

    const plusButton = document.createElement("button");
    plusButton.type = "button";
    plusButton.setAttribute("aria-label", `Læg én til ${item.name}`);
    plusButton.textContent = "+";

    minusButton.addEventListener("click", () => {
        markCount(item, input, Number(input.value) - 1);
    });
    plusButton.addEventListener("click", () => {
        markCount(item, input, Number(input.value) + 1);
    });
    input.addEventListener("input", () => markCount(item, input, input.value));

    stepper.append(minusButton, input, plusButton);
    stockControl.append(stockLabel, stepper);

    const counted = document.createElement("p");
    counted.className = "inventory-counted";
    counted.textContent = formatCountedAt(item.last_counted_at);

    if (item.note) {
        const note = document.createElement("p");
        note.className = "inventory-meta";
        note.textContent = item.note;
        card.append(header, stockControl, counted, note);
    } else {
        card.append(header, stockControl, counted);
    }

    return card;
}

function renderInventory() {
    const items = filteredItems();
    inventoryList.replaceChildren();

    if (items.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Ingen varer matcher de valgte filtre.";
        inventoryList.appendChild(empty);
        return;
    }

    items.forEach(item => inventoryList.appendChild(createInventoryCard(item)));
}

async function loadInventory() {
    try {
        const response = await authenticatedFetch("/api/inventory/items");
        if (!response.ok) {
            throw new Error("Kunne ikke hente lageret");
        }
        const payload = await response.json();
        inventoryItems = payload.items;
        populateCategories();
        renderInventory();
        setStatus(`${inventoryItems.length} aktive varer i kataloget.`);
    } catch (error) {
        if (error.message !== "Unauthorized") {
            setStatus(error.message);
            console.error("Inventory load failed:", error);
        }
    }
}

function resetItemForm() {
    itemForm.reset();
    itemId.value = "";
    itemStock.value = "0";
    formStatus.textContent = "";
    initialStockField.hidden = false;
    archiveItemButton.hidden = true;
}

function openAddDialog() {
    resetItemForm();
    itemDialogTitle.textContent = "Tilføj vare";
    itemDialog.showModal();
    itemName.focus();
}

function openEditDialog(item) {
    resetItemForm();
    itemDialogTitle.textContent = "Redigér vare";
    itemId.value = item.id;
    itemName.value = item.name;
    itemCategory.value = item.category;
    itemUnit.value = item.unit;
    itemStore.value = item.default_store;
    itemNote.value = item.note;
    initialStockField.hidden = true;
    archiveItemButton.hidden = false;
    itemDialog.showModal();
    itemName.focus();
}

async function saveItem(event) {
    event.preventDefault();
    const editingId = itemId.value;
    const body = {
        name: itemName.value,
        category: itemCategory.value,
        unit: itemUnit.value,
        default_store: itemStore.value,
        note: itemNote.value,
    };

    if (!editingId) {
        body.stock_quantity = Number(itemStock.value) || 0;
    }

    try {
        const response = await authenticatedFetch(
            editingId ? `/api/inventory/items/${editingId}` : "/api/inventory/items",
            {
                method: editingId ? "PUT" : "POST",
                body: JSON.stringify(body),
            }
        );
        const payload = await response.json();
        if (!response.ok) {
            formStatus.textContent = payload.message || "Varen kunne ikke gemmes.";
            return;
        }
        itemDialog.close();
        await loadInventory();
    } catch (error) {
        if (error.message !== "Unauthorized") {
            formStatus.textContent = "Varen kunne ikke gemmes.";
        }
    }
}

async function archiveItem() {
    const editingId = itemId.value;
    if (!editingId) {
        return;
    }

    try {
        const response = await authenticatedFetch(
            `/api/inventory/items/${editingId}`,
            { method: "DELETE" }
        );
        if (!response.ok) {
            const payload = await response.json();
            formStatus.textContent = payload.message || "Varen kunne ikke arkiveres.";
            return;
        }
        pendingCounts.delete(Number(editingId));
        itemDialog.close();
        await loadInventory();
    } catch (error) {
        if (error.message !== "Unauthorized") {
            formStatus.textContent = "Varen kunne ikke arkiveres.";
        }
    }
}

async function saveCounts() {
    if (pendingCounts.size === 0) {
        return;
    }

    saveCountsButton.disabled = true;
    setStatus("Gemmer optælling...");

    try {
        for (const [id, quantity] of pendingCounts.entries()) {
            const response = await authenticatedFetch(
                `/api/inventory/items/${id}/stock`,
                {
                    method: "PATCH",
                    body: JSON.stringify({ stock_quantity: quantity }),
                }
            );
            if (!response.ok) {
                throw new Error("Optællingen kunne ikke gemmes.");
            }
        }
        pendingCounts.clear();
        await loadInventory();
        setStatus("Optællingen er gemt.");
    } catch (error) {
        saveCountsButton.disabled = false;
        if (error.message !== "Unauthorized") {
            setStatus(error.message);
        }
    }
}

function parseImportedRows(rows) {
    let currentCategory = "";
    const items = [];

    rows.forEach((row, index) => {
        if (index <= 2 || row.length === 0) {
            return;
        }

        const first = row[0];
        const second = row[1];
        const third = row[2];
        const secondMissing = second === null || second === "" || second === undefined;
        const thirdMissing = third === null || third === "" || third === undefined;

        if (first && secondMissing && thirdMissing) {
            currentCategory = String(first).trim();
            return;
        }

        if (first && !secondMissing && !thirdMissing) {
            items.push({
                name: String(first).trim(),
                category: currentCategory || "Ukategoriseret",
                unit: String(row[3] || "stk").trim(),
                default_store: String(row[8] || "").trim(),
            });
        }
    });

    return items;
}

async function importInventory(file) {
    try {
        if (typeof XLSX === "undefined") {
            throw new Error("Spreadsheet-biblioteket kunne ikke indlæses.");
        }

        const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
        const sheet = workbook.Sheets.indkob;
        if (!sheet) {
            throw new Error("Filen mangler det forventede ark indkob.");
        }

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        const items = parseImportedRows(rows);
        if (items.length === 0) {
            throw new Error("Arket indeholder ingen genkendelige varer.");
        }

        const response = await authenticatedFetch("/api/inventory/import", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || "Importen mislykkedes.");
        }

        pendingCounts.clear();
        await loadInventory();
        setStatus(
            `Import færdig: ${result.created} oprettet, ${result.matched} eksisterede allerede, ${result.invalid} ugyldige.`
        );
    } catch (error) {
        setStatus(error.message);
        console.error("Inventory import failed:", error);
    } finally {
        importFile.value = "";
    }
}

document.getElementById("addItemButton").addEventListener("click", openAddDialog);
document.getElementById("closeDialogButton").addEventListener("click", () => {
    itemDialog.close();
});
itemForm.addEventListener("submit", saveItem);
archiveItemButton.addEventListener("click", archiveItem);
saveCountsButton.addEventListener("click", saveCounts);
searchInput.addEventListener("input", renderInventory);
stockFilter.addEventListener("change", renderInventory);
categoryFilter.addEventListener("change", renderInventory);
importFile.addEventListener("change", event => {
    const [file] = event.target.files;
    if (file) {
        importInventory(file);
    }
});

document.getElementById("logoutButton").addEventListener("click", () => {
    localStorage.removeItem("authToken");
    window.location.href = "member-login.html";
});

verifyAccess().then(hasAccess => {
    if (hasAccess) {
        loadInventory();
    }
});
