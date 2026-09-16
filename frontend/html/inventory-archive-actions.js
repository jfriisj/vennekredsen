async function deleteArchivedItemPermanently(item) {
    const confirmed = window.confirm(
        `Slet ${item.name} permanent? Handlingen kan ikke fortrydes.`
    );
    if (!confirmed) {
        return;
    }

    setStatus(`Sletter ${item.name} permanent...`);
    try {
        const response = await authenticatedFetch(
            `/api/inventory/items/${item.id}/permanent`,
            { method: "DELETE" }
        );
        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.message || "Varen kunne ikke slettes permanent.");
        }

        inventoryItems = inventoryItems.filter(entry => entry.id !== item.id);
        populateCategories();
        renderInventory();
        renderArchive();
        setStatus(`${item.name} er slettet permanent.`);
    } catch (error) {
        if (error.message !== "Unauthorized") {
            setStatus(error.message);
        }
    }
}

function decorateArchiveRows() {
    const items = archivedItems();
    const rows = [...archiveList.querySelectorAll(".archive-row")];

    rows.forEach((row, index) => {
        if (row.querySelector(".permanent-delete-action")) {
            return;
        }

        const item = items[index];
        if (!item) {
            return;
        }

        const restoreButton = row.querySelector(".secondary-action");
        if (!restoreButton) {
            return;
        }

        const actions = document.createElement("div");
        actions.className = "archive-row-actions";
        restoreButton.replaceWith(actions);
        actions.appendChild(restoreButton);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "danger-action permanent-delete-action";
        deleteButton.textContent = "Slet permanent";
        deleteButton.setAttribute(
            "aria-label",
            `Slet ${item.name} permanent`
        );
        deleteButton.addEventListener("click", () =>
            deleteArchivedItemPermanently(item)
        );
        actions.appendChild(deleteButton);
    });
}

const archiveObserver = new MutationObserver(decorateArchiveRows);
archiveObserver.observe(archiveList, { childList: true });
decorateArchiveRows();
