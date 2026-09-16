const token = localStorage.getItem("authToken");
const mainContent = document.getElementById("main-content");
const inventoryStatus = document.getElementById("inventoryStatus");
const inventoryList = document.getElementById("inventoryList");
const archiveList = document.getElementById("archiveList");
const archiveDialog = document.getElementById("archiveDialog");
const archiveCount = document.getElementById("archive-count");
const searchInput = document.getElementById("searchInput");
const stockFilter = document.getElementById("stockFilter");
const categoryFilter = document.getElementById("categoryFilter");
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

function formatCountedAt(value) {
    if (!value) {
        return "Ikke optalt endnu";
    }
    const date = new Date(value);
    return `Senest optalt ${date.toLocaleString("da-DK")}`;
}

function activeItems() {
    return inventoryItems.filter(item => item.active);
}

function archivedItems() {
    return inventoryItems.filter(item => !item.active);
}

function populateCategories() {
    const previous = categoryFilter.value;
    const categories = [
        ...new Set(activeItems().map(item => item.category)),
    ].sort((a, b) => a.localeCompare(b, "da"));

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

    return activeItems().filter(item => {
        const matchesSearch =
            !query || item.name.toLocaleLowerCase("da-DK").includes(query);
        const matchesCategory = !category || item.category === category;
        const matchesStock =
            stock === "all" ||
            (stock === "in_stock" && item.stock_quantity > 0) ||
            (stock === "zero" && item.stock_quantity === 0);
        return matchesSearch && matchesCategory && matchesStock;
    });
}

function replaceItem(updatedItem) {
    inventoryItems = inventoryItems.map(item =>
        item.id === updatedItem.id ? updatedItem : item
    );
}

async function saveStock(item, input, nextValue, controls) {
    const value = Math.max(0, Number(nextValue) || 0);
    const previousValue = item.stock_quantity;
    input.value = value;
    controls.forEach(control => {
        control.disabled = true;
    });
    setStatus(`Gemmer ${item.name}...`);

    try {
        const response = await authenticatedFetch(
            `/api/inventory/items/${item.id}/stock`,
            {
                method: "PATCH",
                body: JSON.stringify({ stock_quantity: value }),
            }
        );
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(
                payload.message || "Lagerantallet kunne ikke gemmes."
            );
        }
        replaceItem(payload.item);
        input.value = payload.item.stock_quantity;
        setStatus(
            `${item.name} er gemt med ${payload.item.stock_quantity} ${item.unit}.`
        );
        renderInventory();
    } catch (error) {
        input.value = previousValue;
        if (error.message !== "Unauthorized") {
            setStatus(error.message);
        }
    } finally {
        controls.forEach(control => {
            control.disabled = false;
        });
    }
}

async function restoreItem(item) {
    setStatus(`Gendanner ${item.name}...`);
    try {
        const response = await authenticatedFetch(
            `/api/inventory/items/${item.id}/active`,
            {
                method: "PATCH",
                body: JSON.stringify({ active: true }),
            }
        );
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.message || "Varen kunne ikke gendannes.");
        }
        replaceItem(payload.item);
        populateCategories();
        renderInventory();
        renderArchive();
        setStatus(`${item.name} er gendannet.`);
    } catch (error) {
        if (error.message !== "Unauthorized") {
            setStatus(error.message);
        }
    }
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
    card.appendChild(header);

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
    input.value = item.stock_quantity;

    const plusButton = document.createElement("button");
    plusButton.type = "button";
    plusButton.setAttribute("aria-label", `Læg én til ${item.name}`);
    plusButton.textContent = "+";

    const controls = [minusButton, input, plusButton];
    minusButton.addEventListener("click", () => {
        saveStock(item, input, Number(input.value) - 1, controls);
    });
    plusButton.addEventListener("click", () => {
        saveStock(item, input, Number(input.value) + 1, controls);
    });
    input.addEventListener("change", () => {
        saveStock(item, input, input.value, controls);
    });

    stepper.append(minusButton, input, plusButton);
    stockControl.append(stockLabel, stepper);
    card.appendChild(stockControl);

    const counted = document.createElement("p");
    counted.className = "inventory-counted";
    counted.textContent = formatCountedAt(item.last_counted_at);
    card.appendChild(counted);

    if (item.note) {
        const note = document.createElement("p");
        note.className = "inventory-meta";
        note.textContent = item.note;
        card.appendChild(note);
    }

    return card;
}

function renderInventory() {
    const items = filteredItems();
    inventoryList.replaceChildren();

    if (items.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Ingen aktive varer matcher de valgte filtre.";
        inventoryList.appendChild(empty);
        return;
    }

    items.forEach(item => inventoryList.appendChild(createInventoryCard(item)));
}

function renderArchive() {
    const items = archivedItems();
    archiveCount.textContent = String(items.length);
    archiveList.replaceChildren();

    if (items.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "Arkivet er tomt.";
        archiveList.appendChild(empty);
        return;
    }

    items.forEach(item => {
        const row = document.createElement("div");
        row.className = "archive-row";

        const details = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = item.name;
        const meta = document.createElement("span");
        meta.className = "inventory-meta";
        meta.textContent = [item.category, item.unit, item.default_store]
            .filter(Boolean)
            .join(" · ");
        details.append(name, meta);

        const restoreButton = document.createElement("button");
        restoreButton.type = "button";
        restoreButton.className = "secondary-action";
        restoreButton.textContent = "Gendan";
        restoreButton.setAttribute("aria-label", `Gendan ${item.name}`);
        restoreButton.addEventListener("click", () => restoreItem(item));

        row.append(details, restoreButton);
        archiveList.appendChild(row);
    });
}

async function loadInventory() {
    try {
        const response = await authenticatedFetch(
            "/api/inventory/items?include_inactive=true"
        );
        if (!response.ok) {
            throw new Error("Kunne ikke hente lageret");
        }
        const payload = await response.json();
        inventoryItems = payload.items;
        populateCategories();
        renderInventory();
        renderArchive();
        setStatus(
            `${activeItems().length} aktive varer · ${archivedItems().length} arkiverede.`
        );
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
            editingId
                ? `/api/inventory/items/${editingId}`
                : "/api/inventory/items",
            {
                method: editingId ? "PUT" : "POST",
                body: JSON.stringify(body),
            }
        );
        const payload = await response.json();
        if (!response.ok) {
            formStatus.textContent =
                payload.message || "Varen kunne ikke gemmes.";
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
            formStatus.textContent =
                payload.message || "Varen kunne ikke arkiveres.";
            return;
        }
        itemDialog.close();
        await loadInventory();
        setStatus("Varen er arkiveret og kan gendannes fra Arkiv.");
    } catch (error) {
        if (error.message !== "Unauthorized") {
            formStatus.textContent = "Varen kunne ikke arkiveres.";
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
        const secondMissing =
            second === null || second === "" || second === undefined;
        const thirdMissing =
            third === null || third === "" || third === undefined;

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

        const workbook = XLSX.read(await file.arrayBuffer(), {
            cellDates: true,
        });
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

document
    .getElementById("addItemButton")
    .addEventListener("click", openAddDialog);
document.getElementById("closeDialogButton").addEventListener("click", () => {
    itemDialog.close();
});
document.getElementById("openArchiveButton").addEventListener("click", () => {
    renderArchive();
    archiveDialog.showModal();
});
document.getElementById("closeArchiveButton").addEventListener("click", () => {
    archiveDialog.close();
});
itemForm.addEventListener("submit", saveItem);
archiveItemButton.addEventListener("click", archiveItem);
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
