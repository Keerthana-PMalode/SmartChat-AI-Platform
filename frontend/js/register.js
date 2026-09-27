const form = document.getElementById("register-form");

const usernameInput = document.getElementById("register-username");

const passwordInput = document.getElementById("register-password");

const confirmPasswordInput = document.getElementById(
  "register-password-confirm",
);

const registerButton = document.getElementById("register-btn");

const statusElement = document.getElementById("register-status");

function showStatus(message, type = "error") {
  statusElement.textContent = message;
  statusElement.className = `register-status ${type}`;
  statusElement.hidden = false;
}

async function checkRegistrationAvailability() {
  try {
    const response = await fetch("/auth/admin/settings/public");

    if (!response.ok) {
      throw new Error("Failed to load registration settings.");
    }

    const settings = await response.json();

    if (!settings.allow_user_registration) {
      showStatus("User registration is currently disabled.", "error");

      registerButton.disabled = true;

      return false;
    }

    registerButton.disabled = false;

    return true;
  } catch (error) {
    console.error(error);

    showStatus("Unable to determine registration availability.", "error");

    registerButton.disabled = true;

    return false;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();

  const password = passwordInput.value;

  const confirmPassword = confirmPasswordInput.value;

  if (password !== confirmPassword) {
    showStatus("Passwords do not match.", "error");

    return;
  }

  registerButton.disabled = true;

  try {
    const response = await fetch("/auth/register", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "Registration failed.");
    }

    showStatus("Registration successful. You can now log in.", "success");

    form.reset();
  } catch (error) {
    console.error("Registration failed:", error);

    showStatus(error.message || "Registration failed.", "error");
  } finally {
    await checkRegistrationAvailability();
  }
});

checkRegistrationAvailability();
