import { fetchDashboard } from "./dashboard.service.js";
import {
  renderDashboardCharts,
  destroyDashboardCharts,
} from "./dashboard.charts.js";

/* =========================================================
   DASHBOARD STATE
========================================================= */

let dashboardInitialized = false;
let dashboardLoading = false;

/* =========================================================
   NORMALIZE ACTIVITY DATA
========================================================= */

/*
 * Dashboard API returns:
 *
 * {
 *   labels: [...],
 *   conversations: [...],
 *   messages: [...]
 * }
 *
 * Older implementations may return:
 *
 * [
 *   {
 *     date: "2026-09-17",
 *     chats: 4,
 *     messages: 12
 *   }
 * ]
 */

function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  const date = new Date(String(dateString) + "T00:00:00");

  if (Number.isNaN(date.getTime())) {
    return String(dateString);
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function normalizeActivityData(data) {
  if (!data) {
    return {
      labels: [],
      conversations: [],
      messages: [],
    };
  }

  /* -------------------------------------------------------
     CURRENT API FORMAT
  ------------------------------------------------------- */

  if (!Array.isArray(data) && typeof data === "object") {
    return {
      labels: Array.isArray(data.labels) ? data.labels : [],

      conversations: Array.isArray(data.conversations)
        ? data.conversations.map((value) => Number(value ?? 0))
        : [],

      messages: Array.isArray(data.messages)
        ? data.messages.map((value) => Number(value ?? 0))
        : [],
    };
  }

  /* -------------------------------------------------------
     LEGACY ARRAY FORMAT
  ------------------------------------------------------- */

  if (Array.isArray(data)) {
    return {
      labels: data.map((item) => formatDate(item.date)),

      conversations: data.map((item) =>
        Number(item.chats ?? item.conversations ?? 0),
      ),

      messages: data.map((item) => Number(item.messages ?? 0)),
    };
  }

  return {
    labels: [],
    conversations: [],
    messages: [],
  };
}

/* =========================================================
   GET ACTIVITY DATA
========================================================= */

function getDashboardActivity(data) {
  return (
    data?.activity ??
    data?.chat_activity ??
    data?.chatActivity ??
    data?.activity_overview ??
    null
  );
}

/* =========================================================
   RENDER DASHBOARD
========================================================= */

function renderDashboard(data) {
  console.log("DASHBOARD CONTROLLER: render", data);

  const activity = getDashboardActivity(data);

  if (!activity) {
    console.warn("Dashboard activity data is missing.");

    destroyDashboardCharts();

    return;
  }

  const normalizedActivity = normalizeActivityData(activity);

  console.log("DASHBOARD ACTIVITY DATA:", normalizedActivity);

  const hasChartData =
    normalizedActivity.labels.length > 0 ||
    normalizedActivity.conversations.length > 0 ||
    normalizedActivity.messages.length > 0;

  if (!hasChartData) {
    console.warn("Dashboard activity contains no chart data.");

    destroyDashboardCharts();

    return;
  }

  /*
   * Chart rendering has exactly one owner:
   *
   *     dashboard.charts.js
   */
  renderDashboardCharts(normalizedActivity);
}

/* =========================================================
   DASHBOARD INITIALIZATION
========================================================= */

export function initDashboard() {
  if (dashboardLoading) {
    console.log("DASHBOARD: fetch already in progress");

    return;
  }

  if (dashboardInitialized) {
    console.log("DASHBOARD: already initialized");

    return;
  }

  dashboardInitialized = true;
  dashboardLoading = true;

  fetchDashboard()
    .catch((error) => {
      /*
       * fetchDashboard already emits dashboard:error.
       *
       * This catch prevents an unhandled promise rejection.
       */
      console.error("DASHBOARD INITIALIZATION ERROR:", error);
    })
    .finally(() => {
      dashboardLoading = false;
    });
}

/* =========================================================
   DASHBOARD LOADED
========================================================= */

export function handleDashboardLoaded(data) {
  console.log("DASHBOARD CONTROLLER: loaded", data);

  renderDashboard(data);
}

/* =========================================================
   DASHBOARD LOADING
========================================================= */

export function handleDashboardLoading(data) {
  console.log("DASHBOARD CONTROLLER: loading", data);
}

/* =========================================================
   DASHBOARD ERROR
========================================================= */

export function handleDashboardError(data) {
  console.error("DASHBOARD CONTROLLER: error", data);

  /*
   * Allow another initialization attempt after
   * a failed request.
   */
  dashboardInitialized = false;
  dashboardLoading = false;

  destroyDashboardCharts();
}