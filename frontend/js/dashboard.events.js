import { EventBus } from "./admin_events.js";

import {
  initDashboard,
  handleDashboardLoaded,
  handleDashboardLoading,
  handleDashboardError,
} from "./dashboard.controller.js";

let initialized = false;

/* =========================================================
   DASHBOARD EVENTS
========================================================= */

export function initDashboardEvents() {
  if (initialized) {
    return;
  }

  initialized = true;

  /* =======================================================
     DASHBOARD LOADED
  ======================================================= */

  EventBus.on("dashboard:loaded", (event) => {
    console.log("DASHBOARD EVENT LOADED:", event.detail);

    handleDashboardLoaded(event.detail);
  });

  /* =======================================================
     DASHBOARD LOADING
  ======================================================= */

  EventBus.on("dashboard:loading", (event) => {
    console.log("DASHBOARD EVENT LOADING:", event.detail);

    handleDashboardLoading(event.detail);
  });

  /* =======================================================
     DASHBOARD ERROR
  ======================================================= */

  EventBus.on("dashboard:error", (event) => {
    console.error("DASHBOARD EVENT ERROR:", event.detail);

    handleDashboardError(event.detail);
  });

  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  initDashboard();
}
