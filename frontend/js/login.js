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

    const username = document.getElementById("username").value;

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
