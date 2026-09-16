/* global XLSX */

let allItems = [];

const token = localStorage.getItem("authToken");
const mainContent = document.getElementById("main-content");
const fileInput = document.getElementById("fileInput");
const storeSelect = document.getElementById("indkobssted");
const categorySelect = document.getElementById("kategori");
const statusMessage = document.getElementById("statusMessage");
const resultsTable = document.getElementById("resultsTable");
const resultsTitle = document.getElementById("resultsTitle");
const downloadCurrentButton = document.getElementById("downloadCurrent");
const downloadStoreButton = document.getElementById("downloadStore");
const downloadCategoryButton = document.getElementById("downloadCategory");

function redirectToLogin() {
    localStorage.removeItem("authToken");
    window.location.href = "member-login.html";
}

async function verifyAccess() {
    if (!token) {
        redirectToLogin();
        return false;
    }

    try {
        const response = await fetch("/api/me", {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
            redirectToLogin();
            return false;
        }

        mainContent.hidden = false;
        fileInput.disabled = false;
        return true;
    } catch (error) {
        console.error("Authentication check failed:", error);
        redirectToLogin();
        return false;
    }
}

function setStatus(message, state = "neutral") {
    statusMessage.textContent = message;
    statusMessage.dataset.state = state;
}

function parseRows(rows) {
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
            currentCategory = String(first);
            return;
        }

        if (first && !secondMissing && !thirdMissing) {
            items.push({
                kategori: currentCategory,
                vare: first,
                prVoksen: second,
                prBarn: third,
                enhed: row[3] || "",
                totalMaengde: row[5] || "",
                ansvarlig: row[6] || "",
                noter: row[7] || "",
                indkobssted: row[8] || "",
            });
        }
    });

    return items;
}

function uniqueSorted(values) {
    return [...new Set(values.filter(value => value !== ""))].sort((a, b) =>
        String(a).localeCompare(String(b), "da")
    );
}

function populateSelect(select, values, placeholder) {
    select.replaceChildren();
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = placeholder;
    select.appendChild(defaultOption);

    values.forEach(value => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });
}

function updateStats(visibleCount = allItems.length) {
    document.getElementById("totalVarer").textContent = allItems.length;
    document.getElementById("totalSteder").textContent = uniqueSorted(
        allItems.map(item => item.indkobssted)
    ).length;
    document.getElementById("totalKategorier").textContent = uniqueSorted(
        allItems.map(item => item.kategori)
    ).length;
    document.getElementById("visibleVarer").textContent = visibleCount;
}

function getFilteredItems() {
    const selectedStore = storeSelect.value;
    const selectedCategory = categorySelect.value;

    return allItems.filter(item => {
        const storeMatches =
            !selectedStore || item.indkobssted === selectedStore;
        const categoryMatches =
            !selectedCategory || item.kategori === selectedCategory;
        return storeMatches && categoryMatches;
    });
}

function appendCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "";
    row.appendChild(cell);
}

function appendItemRow(item) {
    const row = document.createElement("tr");
    [
        item.vare,
        item.prVoksen,
        item.prBarn,
        item.enhed,
        item.totalMaengde,
        item.ansvarlig,
        item.noter,
        item.indkobssted,
        item.kategori,
    ].forEach(value => appendCell(row, value));
    resultsTable.appendChild(row);
}

function updateTitle() {
    const selectedStore = storeSelect.value;
    const selectedCategory = categorySelect.value;

    if (selectedStore && selectedCategory) {
        resultsTitle.textContent = `${selectedCategory} - ${selectedStore}`;
    } else if (selectedStore) {
        resultsTitle.textContent = `Alle varer - ${selectedStore}`;
    } else if (selectedCategory) {
        resultsTitle.textContent = selectedCategory;
    } else {
        resultsTitle.textContent = "Alle varer";
    }
}

function renderItems() {
    const filteredItems = getFilteredItems();
    resultsTable.replaceChildren();
    updateTitle();
    updateStats(filteredItems.length);

    if (filteredItems.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 9;
        cell.className = "empty-state";
        cell.textContent = "Ingen varer matcher de valgte kriterier.";
        row.appendChild(cell);
        resultsTable.appendChild(row);
        return;
    }

    if (categorySelect.value) {
        filteredItems.forEach(appendItemRow);
        return;
    }

    const categories = uniqueSorted(filteredItems.map(item => item.kategori));
    categories.forEach(category => {
        const headerRow = document.createElement("tr");
        headerRow.className = "category-row";
        const header = document.createElement("th");
        header.colSpan = 9;
        header.scope = "rowgroup";
        header.textContent = category || "Uden kategori";
        headerRow.appendChild(header);
        resultsTable.appendChild(headerRow);

        filteredItems
            .filter(item => item.kategori === category)
            .forEach(appendItemRow);
    });
}

function setControlsEnabled(enabled) {
    storeSelect.disabled = !enabled;
    categorySelect.disabled = !enabled;
    downloadCurrentButton.disabled = !enabled;
    downloadStoreButton.disabled = !enabled;
    downloadCategoryButton.disabled = !enabled;
}

async function loadSpreadsheet(file) {
    setControlsEnabled(false);
    allItems = [];
    updateStats(0);

    try {
        if (typeof XLSX === "undefined") {
            throw new Error("Spreadsheet-biblioteket kunne ikke indlæses.");
        }

        const workbook = XLSX.read(await file.arrayBuffer(), {
            cellDates: true,
            cellFormula: true,
        });
        const sheet = workbook.Sheets.indkob;

        if (!sheet) {
            throw new Error("Filen mangler det forventede ark indkob.");
        }

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        allItems = parseRows(rows);

        if (allItems.length === 0) {
            throw new Error(
                "Arket indeholder ingen genkendelige indkøbsvarer."
            );
        }

        populateSelect(
            storeSelect,
            uniqueSorted(allItems.map(item => item.indkobssted)),
            "Alle indkøbssteder"
        );
        populateSelect(
            categorySelect,
            uniqueSorted(allItems.map(item => item.kategori)),
            "Alle kategorier"
        );
        setControlsEnabled(true);
        renderItems();
        setStatus(
            `${allItems.length} varer indlæst fra ${file.name}.`,
            "success"
        );
    } catch (error) {
        console.error("Spreadsheet load failed:", error);
        allItems = [];
        populateSelect(storeSelect, [], "Alle indkøbssteder");
        populateSelect(categorySelect, [], "Alle kategorier");
        resultsTable.replaceChildren();
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.colSpan = 9;
        cell.className = "empty-state";
        cell.textContent = error.message;
        row.appendChild(cell);
        resultsTable.appendChild(row);
        setStatus(error.message, "error");
        updateStats(0);
    }
}

function exportRows(items, includeStore = true, includeCategory = true) {
    const headers = [
        "Vare",
        "Pr voksen",
        "Pr barn",
        "Enhed",
        "Total mængde",
        "Ansvarlig",
        "Noter",
    ];
    if (includeStore) headers.push("Indkøbssted");
    if (includeCategory) headers.push("Kategori");

    return [
        headers,
        ...items.map(item => {
            const row = [
                item.vare,
                item.prVoksen,
                item.prBarn,
                item.enhed,
                item.totalMaengde,
                item.ansvarlig,
                item.noter,
            ];
            if (includeStore) row.push(item.indkobssted);
            if (includeCategory) row.push(item.kategori);
            return row;
        }),
    ];
}

function downloadCurrentView() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet(exportRows(getFilteredItems())),
        "Filtreret_visning"
    );
    XLSX.writeFile(workbook, "Indkob_filtreret.xlsx");
}

function safeSheetName(value, fallback) {
    const cleaned = String(value)
        .replace(/[\\/:*?"<>|]/g, "")
        .slice(0, 31);
    return cleaned || fallback;
}

function downloadByStore() {
    const workbook = XLSX.utils.book_new();
    uniqueSorted(allItems.map(item => item.indkobssted)).forEach(
        (store, index) => {
            const items = allItems.filter(item => item.indkobssted === store);
            XLSX.utils.book_append_sheet(
                workbook,
                XLSX.utils.aoa_to_sheet(exportRows(items, false, true)),
                safeSheetName(store, `Butik${index + 1}`)
            );
        }
    );
    XLSX.writeFile(workbook, "Indkob_efter_butik.xlsx");
}

function downloadByCategory() {
    const workbook = XLSX.utils.book_new();
    uniqueSorted(allItems.map(item => item.kategori)).forEach(
        (category, index) => {
            const items = allItems.filter(item => item.kategori === category);
            XLSX.utils.book_append_sheet(
                workbook,
                XLSX.utils.aoa_to_sheet(exportRows(items, true, false)),
                safeSheetName(category, `Kategori${index + 1}`)
            );
        }
    );
    XLSX.writeFile(workbook, "Indkob_efter_kategori.xlsx");
}

fileInput.addEventListener("change", event => {
    const [file] = event.target.files;
    if (file) loadSpreadsheet(file);
});
storeSelect.addEventListener("change", renderItems);
categorySelect.addEventListener("change", renderItems);
downloadCurrentButton.addEventListener("click", downloadCurrentView);
downloadStoreButton.addEventListener("click", downloadByStore);
downloadCategoryButton.addEventListener("click", downloadByCategory);

document.getElementById("logoutButton").addEventListener("click", () => {
    localStorage.removeItem("authToken");
    window.location.href = "member-login.html";
});

verifyAccess();
