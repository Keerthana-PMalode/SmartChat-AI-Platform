import { EventBus } from "./admin_events.js";

import {
  initAnalytics,
  handleAnalyticsLoaded,
  handleAnalyticsLoading,
  handleAnalyticsError,
} from "./analytics.controller.js";

let initialized = false;

export function initAnalyticsEvents() {
  if (initialized) {
    return;
  }

  initialized = true;

  EventBus.on("analytics:loaded", (event) => {
    console.log("ANALYTICS EVENT LOADED:", event.detail);
    handleAnalyticsLoaded(event.detail);
  });

  EventBus.on("analytics:loading", (event) => {
    console.log("ANALYTICS EVENT LOADING:", event.detail);
    handleAnalyticsLoading(event.detail);
  });

  EventBus.on("analytics:error", (event) => {
    console.error("ANALYTICS EVENT ERROR:", event.detail);
    handleAnalyticsError(event.detail);
  });

  initAnalytics();
}
