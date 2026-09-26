import { EventBus } from "./admin_events.js";

import {
  getSettings,
  updateSettings,
} from "./admin_api.js";

const settingsForm = document.getElementById("settings-form");
const settingsStatus = document.getElementById("settings-status");

const applicationNameInput = document.getElementById(
  "setting-application-name"
);

const maxMessageLengthInput = document.getElementById(
  "setting-max-message-length"
);

const maintenanceModeInput = document.getElementById(
  "setting-maintenance-mode"
);

const registrationInput = document.getElementById(
  "setting-registration"
);

const saveButton = document.getElementById("settings-save-btn");
const resetButton = document.getElementById("settings-reset-btn");
const refreshButton = document.getElementById("settings-refresh-btn");


/* ============================================================
   DEFAULT SETTINGS
   Must match backend DEFAULT_SETTINGS
============================================================ */

const DEFAULT_SETTINGS = {
  application_name: "ChatBot",
  max_message_length: 5000,
  maintenance_mode: false,
  allow_user_registration: true,
};


/* ============================================================
   LOCAL STATE
============================================================ */

let originalSettings = null;


/* ============================================================
   STATUS
============================================================ */

function showSettingsStatus(message, type = "success") {
  settingsStatus.textContent = message;
  settingsStatus.className = `settings-status ${type}`;
  settingsStatus.hidden = false;
}


function hideSettingsStatus() {
  settingsStatus.hidden = true;
  settingsStatus.textContent = "";
}


/* ============================================================
   POPULATE FORM
============================================================ */

function populateSettings(settings) {
  applicationNameInput.value =
    settings.application_name ?? DEFAULT_SETTINGS.application_name;

  maxMessageLengthInput.value =
    settings.max_message_length ?? DEFAULT_SETTINGS.max_message_length;

  maintenanceModeInput.checked =
    settings.maintenance_mode === true ||
    settings.maintenance_mode === "true";

  registrationInput.checked =
    settings.allow_user_registration === true ||
    settings.allow_user_registration === "true";
}


/* ============================================================
   LOAD SAVED SETTINGS FROM BACKEND
============================================================ */

async function loadSettings() {
  try {
    hideSettingsStatus();

    refreshButton.disabled = true;

    const response = await getSettings();

    const settings = response.settings;

    originalSettings = structuredClone(settings);

    populateSettings(settings);

  } catch (error) {
    console.error("Failed to load settings:", error);

    showSettingsStatus(
      "Failed to load settings.",
      "error"
    );

  } finally {
    refreshButton.disabled = false;
  }
}


/* ============================================================
   RESET FORM TO DEFAULTS
============================================================ */

function resetSettings() {
  populateSettings(DEFAULT_SETTINGS);

  hideSettingsStatus();

  console.log(
    "SETTINGS RESET TO DEFAULTS:",
    DEFAULT_SETTINGS
  );
}


/* ============================================================
   SAVE SETTINGS
============================================================ */

async function saveSettings() {
  saveButton.disabled = true;

  try {
    hideSettingsStatus();

    const payload = {
      application_name:
        applicationNameInput.value.trim(),

      max_message_length:
        Number(maxMessageLengthInput.value),

      maintenance_mode:
        maintenanceModeInput.checked,

      allow_user_registration:
        registrationInput.checked,
    };

    console.log(
      "SETTINGS UPDATE REQUEST:",
      payload
    );

    const response = await updateSettings(payload);

    console.log(
      "SETTINGS UPDATE RESPONSE:",
      response
    );

    /*
     * Update local saved state after successful API request.
     */
    originalSettings = structuredClone(payload);

    showSettingsStatus(
      `Settings saved successfully. Updated: ${
        response.updated?.join(", ") || "none"
      }.`,
      "success"
    );

  } catch (error) {
    console.error(
      "Failed to update settings:",
      error
    );

    showSettingsStatus(
      getSettingsErrorMessage(error),
      "error"
    );

  } finally {
    saveButton.disabled = false;
  }
}


/* ============================================================
   ERROR MESSAGE
============================================================ */

function getSettingsErrorMessage(error) {
  if (error?.status === 422) {
    return "Please check the settings and correct the validation errors.";
  }

  return "Failed to save settings.";
}


/* ============================================================
   EVENTS
============================================================ */

settingsForm.addEventListener(
  "submit",
  (event) => {
    event.preventDefault();
    saveSettings();
  }
);


resetButton.addEventListener(
  "click",
  resetSettings
);


refreshButton.addEventListener(
  "click",
  loadSettings
);


/* ============================================================
   SETTINGS NAVIGATION
============================================================ */

EventBus.on("settings:load-requested", () => {
  console.log("SETTINGS CONTROLLER: loading settings");

  loadSettings();
});