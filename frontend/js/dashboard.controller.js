import { fetchDashboard } from "./dashboard.service.js";

/* =========================================================
   DASHBOARD STATE
========================================================= */

let activityChart = null;
let comparisonChart = null;

let dashboardInitialized = false;
let dashboardLoading = false;

/* =========================================================
   HELPERS
========================================================= */

function getElement(id) {
  return document.getElementById(id);
}

function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  const date = new Date(String(dateString) + "T00:00:00");

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/* =========================================================
   CHART CLEANUP
========================================================= */

function destroyCharts() {
  if (activityChart) {
    activityChart.destroy();
    activityChart = null;
  }

  if (comparisonChart) {
    comparisonChart.destroy();
    comparisonChart = null;
  }
}

/* =========================================================
   NORMALIZE ACTIVITY DATA
========================================================= */

/*
 * Dashboard API returns activity in this format:
 *
 * {
 *   labels: [...],
 *   conversations: [...],
 *   messages: [...]
 * }
 *
 * Older implementations expected an array of objects.
 * Normalize everything here so the chart functions receive
 * a consistent structure.
 */

function normalizeActivityData(data) {
  if (!data) {
    return {
      labels: [],
      conversations: [],
      messages: [],
    };
  }

  /*
   * Current API format:
   *
   * {
   *   labels: [],
   *   conversations: [],
   *   messages: []
   * }
   */
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

  /*
   * Backward compatibility with the old array format:
   *
   * [
   *   {
   *     date: "2026-09-17",
   *     chats: 4,
   *     messages: 12
   *   }
   * ]
   */
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
   ACTIVITY CHART
========================================================= */

function renderActivityChart(data) {
  const canvas = getElement("dashboard-activity-chart");

  if (!canvas) {
    console.warn("Dashboard activity chart canvas not found.");

    return;
  }

  if (typeof Chart === "undefined") {
    console.error("Chart.js is not loaded.");

    return;
  }

  const { labels, conversations, messages } = normalizeActivityData(data);

  console.log("DASHBOARD ACTIVITY CHART:", {
    labels,
    conversations,
    messages,
  });

  activityChart = new Chart(canvas, {
    type: "line",

    data: {
      labels,

      datasets: [
        {
          label: "Conversations",

          data: conversations,

          borderColor: "#4f46e5",

          backgroundColor: "rgba(79, 70, 229, 0.12)",

          borderWidth: 2,

          tension: 0.35,

          fill: true,

          pointRadius: 3,

          pointHoverRadius: 5,
        },

        {
          label: "Messages",

          data: messages,

          borderColor: "#06b6d4",

          backgroundColor: "rgba(6, 182, 212, 0.08)",

          borderWidth: 2,

          tension: 0.35,

          fill: false,

          pointRadius: 3,

          pointHoverRadius: 5,
        },
      ],
    },

    options: {
      responsive: true,

      maintainAspectRatio: false,

      interaction: {
        mode: "index",

        intersect: false,
      },

      plugins: {
        legend: {
          display: true,

          position: "top",
        },

        tooltip: {
          enabled: true,
        },
      },

      scales: {
        x: {
          grid: {
            display: false,
          },
        },

        y: {
          beginAtZero: true,

          ticks: {
            precision: 0,
          },
        },
      },
    },
  });
}

/* =========================================================
   COMPARISON CHART
========================================================= */

function renderComparisonChart(data) {
  const canvas = getElement("dashboard-comparison-chart");

  if (!canvas) {
    console.warn("Dashboard comparison chart canvas not found.");

    return;
  }

  if (typeof Chart === "undefined") {
    console.error("Chart.js is not loaded.");

    return;
  }

  const { labels, conversations, messages } = normalizeActivityData(data);

  comparisonChart = new Chart(canvas, {
    type: "bar",

    data: {
      labels,

      datasets: [
        {
          label: "Conversations",

          data: conversations,

          backgroundColor: "rgba(79, 70, 229, 0.75)",

          borderColor: "#4f46e5",

          borderWidth: 1,

          borderRadius: 4,
        },

        {
          label: "Messages",

          data: messages,

          backgroundColor: "rgba(6, 182, 212, 0.75)",

          borderColor: "#06b6d4",

          borderWidth: 1,

          borderRadius: 4,
        },
      ],
    },

    options: {
      responsive: true,

      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: true,

          position: "top",
        },

        tooltip: {
          enabled: true,
        },
      },

      scales: {
        x: {
          grid: {
            display: false,
          },
        },

        y: {
          beginAtZero: true,

          ticks: {
            precision: 0,
          },
        },
      },
    },
  });
}

/* =========================================================
   RENDER DASHBOARD
========================================================= */

function renderDashboard(data) {
  console.log("DASHBOARD RENDER DATA:", data);

  /*
   * Current backend response:
   *
   * data.activity = {
   *   labels: [...],
   *   conversations: [...],
   *   messages: [...]
   * }
   *
   * Keep support for alternative property names in case
   * another dashboard response uses them.
   */

  const activity =
    data?.activity ??
    data?.chat_activity ??
    data?.chatActivity ??
    data?.activity_overview ??
    null;

  console.log("DASHBOARD ACTIVITY DATA:", activity);

  if (!activity) {
    console.error("Dashboard activity data is missing:", data);

    destroyCharts();

    return;
  }

  const normalizedActivity = normalizeActivityData(activity);

  if (
    !normalizedActivity.labels.length &&
    !normalizedActivity.conversations.length &&
    !normalizedActivity.messages.length
  ) {
    console.warn("Dashboard activity contains no chart data:", activity);

    destroyCharts();

    return;
  }

  /*
   * Destroy old Chart.js instances before creating new ones.
   */
  destroyCharts();

  renderActivityChart(normalizedActivity);

  renderComparisonChart(normalizedActivity);
}

/* =========================================================
   DASHBOARD INITIALIZATION
========================================================= */

export function initDashboard() {
  /*
   * Prevent duplicate dashboard requests when navigation
   * or initialization fires more than once.
   */

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
   * Allow a future retry if the initial request fails.
   */

  dashboardInitialized = false;
  dashboardLoading = false;

  destroyCharts();
}
