// ==========================================================
// Admin State Module - admin_state.js
// Centralized application state for Admin Dashboard
// ==========================================================

/* =========================================================
   CURRENT SECTION
========================================================= */

let currentSection = "dashboard";

/* =========================================================
   ALLOWED SECTIONS
========================================================= */

const allowedSections = new Set([
  "dashboard",
  "users",
  "chat-history",
  "analytics",
]);

/* =========================================================
   SET CURRENT SECTION
========================================================= */

/**
 * Update the current dashboard section.
 *
 * @param {string} section
 * @returns {boolean}
 */
export function setCurrentSection(section) {
  if (!canNavigateTo(section)) {
    console.warn("ADMIN STATE: invalid section:", section);

    return false;
  }

  currentSection = section;

  console.log("ADMIN STATE: current section =", currentSection);

  return true;
}

/* =========================================================
   GET CURRENT SECTION
========================================================= */

/**
 * Retrieve the current dashboard section.
 *
 * @returns {string}
 */
export function getCurrentSection() {
  return currentSection;
}

/* =========================================================
   NAVIGATION GUARD
========================================================= */

/**
 * Determine whether a section is a valid
 * admin dashboard section.
 *
 * @param {string} section
 * @returns {boolean}
 */
export function canNavigateTo(section) {
  return allowedSections.has(section);
}
