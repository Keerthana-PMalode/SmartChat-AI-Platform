document.addEventListener("DOMContentLoaded", () => {
  console.log("Login JS loaded");

  let selectedRole = "";

  const API_BASE_URL = "/auth";
  const title = document.getElementById("title");
  const roleSelection = document.getElementById("role-selection");
  const loginForm = document.getElementById("login-form");

  const userBtn = document.getElementById("user-login-btn");
  const adminBtn = document.getElementById("admin-login-btn");

  const error = document.getElementById("error");

  // -----------------------------
  // Role Selection
  // -----------------------------

  userBtn.addEventListener("click", () => {
    selectedRole = "user";

    title.textContent = "User Login";

    roleSelection.classList.add("hidden");
    loginForm.classList.remove("hidden");
  });

  adminBtn.addEventListener("click", () => {
    selectedRole = "admin";

    title.textContent = "Admin Login";

    roleSelection.classList.add("hidden");
    loginForm.classList.remove("hidden");
  });

  // -----------------------------
  // Login
  // -----------------------------

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    console.log("Login submit triggered");

    const username = document.getElementById("username").value;

    const password = document.getElementById("password").value;

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

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();

      // Store role
      localStorage.setItem("role", selectedRole);

      // Existing success handler
      handleLoginSuccess(data, username);

      // Redirect based on role
      if (selectedRole === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "chat.html";
      }
    } catch (err) {
      console.error("Login error:", err);

      error.innerText = "Login failed";
    }
  });
});
