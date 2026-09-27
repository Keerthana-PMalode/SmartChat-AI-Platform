document.addEventListener("DOMContentLoaded", () => {
  console.log("Login JS loaded");

  /* =========================
     STATE
  ========================= */

  let selectedRole = "";

  /* =========================
     API CONFIGURATION
  ========================= */

  const API_BASE_URL = "/auth";

  /* =========================
     DOM ELEMENTS
  ========================= */

  const title = document.getElementById("title");

  const roleSelection = document.getElementById("role-selection");

  const loginForm = document.getElementById("login-form");

  const userBtn = document.getElementById("user-login-btn");

  const adminBtn = document.getElementById("admin-login-btn");

  const error = document.getElementById("error");

  /* =========================
     LOAD REGISTRATION SETTING
  ========================= */

  loadRegistrationSetting();

  /* =========================
     ROLE SELECTION
  ========================= */

  userBtn?.addEventListener("click", () => {
    selectedRole = "user";

    title.textContent = "User Login";

    roleSelection.classList.add("hidden");

    loginForm.classList.remove("hidden");
  });

  adminBtn?.addEventListener("click", () => {
    selectedRole = "admin";

    title.textContent = "Admin Login";

    roleSelection.classList.add("hidden");

    loginForm.classList.remove("hidden");
  });

  /* =========================
     LOGIN
  ========================= */

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    console.log("Login submit triggered");

    /* =========================
       FORM VALUES
    ========================= */

    const username = document.getElementById("username").value.trim();

    const password = document.getElementById("password").value;

    /* =========================
       API REQUEST
    ========================= */

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          username,
          password,
          role: selectedRole,
        }),
      });

      console.log("Login status:", response.status);

      /* =========================
         LOGIN FAILURE
      ========================= */

      if (!response.ok) {
        throw new Error("Login failed");
      }

      /* =========================
         LOGIN SUCCESS
      ========================= */

      const data = await response.json();

      /* =========================
         STORE USER ROLE
      ========================= */

      localStorage.setItem("role", selectedRole);

      /* =========================
         SUCCESS HANDLER
      ========================= */

      handleLoginSuccess(data, username);

      /* =========================
         ROLE-BASED REDIRECT
      ========================= */

      if (selectedRole === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "chat.html";
      }
    } catch (err) {
      console.error("Login error:", err);

      if (error) {
        error.innerText = "Login failed";
      }
    }
  });
});

/* ============================================================
   LOAD PUBLIC REGISTRATION SETTING
============================================================ */

async function loadRegistrationSetting() {
  const container = document.getElementById("registration-link-container");

  /*
   * Safety check.
   * If the element does not exist, there is nothing to update.
   */

  if (!container) {
    console.warn("Registration link container not found.");

    return;
  }

  /*
   * Keep registration hidden until
   * the backend confirms that it is enabled.
   */

  container.hidden = true;

  try {
    const response = await fetch("/auth/admin/settings/public");

    if (!response.ok) {
      throw new Error("Failed to load public settings");
    }

    const settings = await response.json();

    console.log("Public settings:", settings);

    /*
     * Show registration link only when
     * backend explicitly returns true.
     */

    container.hidden = settings.allow_user_registration !== true;
  } catch (error) {
    console.error("Failed to load registration setting:", error);

    /*
     * Fail closed:
     * registration remains hidden if
     * the settings request fails.
     */

    container.hidden = true;
  }
}
