import { api } from "./admin_api.js";
import { EventBus } from "./admin_events.js";

/* =========================================================
   FETCH DASHBOARD
========================================================= */

export async function fetchDashboard() {
  EventBus.emit("dashboard:loading", {
    loading: true,
  });

  try {
    const response = await api.get("/admin/dashboard");

    console.log("DASHBOARD SERVICE:", response);

    EventBus.emit("dashboard:loaded", response);

    return response;
  } catch (error) {
    console.error("Failed to load dashboard:", error);

    EventBus.emit("dashboard:error", {
      error,
      message: error.message,
    });

    throw error;
  } finally {
    EventBus.emit("dashboard:loading", {
      loading: false,
    });
  }
}
