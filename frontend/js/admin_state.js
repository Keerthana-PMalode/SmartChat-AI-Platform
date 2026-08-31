/* ==========================================================
   Admin State Module - admin_state.js
   Centralized application state for Admin Dashboard
========================================================== */
// admin_state.js

// Track the current section of the admin dashboard
let currentSection = "dashboard";

/**
 * Update the current section
 * @param {string} section - The section identifier (e.g. "users", "analytics")
 */
export function setCurrentSection(section) {
  console.log("admin_state.js loaded");
  currentSection = section;
}

/**
 * Retrieve the current section
 * @returns {string} - The current section identifier
 */
export function getCurrentSection() {
  return currentSection;
}

/**
 * Stubbed navigation guard
 * @param {string} section - The section to navigate to
 * @returns {boolean} - Whether navigation is allowed
 */
export function canNavigateTo(section) {
  // For now, allow all sections
  return true;

  // Later you can add rules, e.g.:
  // return section !== "settings" || userIsAdmin();
}
