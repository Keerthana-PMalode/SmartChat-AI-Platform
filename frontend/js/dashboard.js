import { initDashboardEvents } from "./dashboard.events.js";

let initialized = false;

export function initDashboardSection() {
  if (initialized) {
    return;
  }

  initialized = true;

  initDashboardEvents();
}
