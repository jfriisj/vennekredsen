// Function to initialize the login/logout button
function initializeLoginButton() {
    const adminNavItem = document.getElementById("adminNavItem");
    if (!adminNavItem) return; // Exit if element doesn't exist

    const token = localStorage.getItem("adminToken");

    // Clear existing content
    adminNavItem.innerHTML = "";

    if (token) {
        // User is logged in - show admin panel link and logout button
        const adminButton = document.createElement("div");
        adminButton.className = "btn-group";
        adminButton.innerHTML = `
      <a href="admin-panel.html" class="btn btn-outline-light btn-sm">Admin Panel</a>
      <button class="btn btn-outline-danger btn-sm" id="logoutBtn">Log ud</button>
    `;
        adminNavItem.appendChild(adminButton);

        // Add logout functionality
        document
            .getElementById("logoutBtn")
            .addEventListener("click", function () {
                localStorage.removeItem("adminToken");
                window.location.reload();
            });
    } else {
        // User is not logged in - show login button
        const loginButton = document.createElement("a");
        loginButton.href = "admin-login.html";
        loginButton.className = "btn btn-outline-light btn-sm login-btn";
        loginButton.textContent = "Log ind";
        adminNavItem.appendChild(loginButton);
    }
}

// Check if the document is already loaded
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeLoginButton);
} else {
    initializeLoginButton();
}
