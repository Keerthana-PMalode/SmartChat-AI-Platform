import {
  fetchAnalytics,
  setAnalyticsDateRange,
  refreshAnalytics,
  exportAnalytics,
} from "./analytics.service.js";

const state = {
  data: null,
  loading: false,
};

let initialized = false;

function $(selector) {
  return document.querySelector(selector);
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value ?? 0));
}

function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ============================================================
   INITIALIZATION
============================================================ */

export function initAnalytics() {
  if (initialized) {
    return;
  }

  initialized = true;

  bindEvents();

  setDefaultDateRange();

  fetchAnalytics();
}

/* ============================================================
   EVENTS
============================================================ */

function bindEvents() {
  const applyButton = $("#analytics-apply-filter");

  if (applyButton) {
    applyButton.addEventListener("click", applyDateFilter);
  }

  const refreshButton = $("#analytics-refresh");

  if (refreshButton) {
    refreshButton.addEventListener("click", () => refreshAnalytics());
  }

  const exportButton = $("#analytics-export");

  if (exportButton) {
    exportButton.addEventListener("click", () => exportAnalytics());
  }

  const preset = $("#analytics-date-preset");

  if (preset) {
    preset.addEventListener("change", handleDatePreset);
  }
}

/* ============================================================
   DATE FILTER
============================================================ */

function setDefaultDateRange() {
  const end = new Date();
  const start = new Date();

  start.setDate(end.getDate() - 29);

  const startInput = $("#analytics-start-date");
  const endInput = $("#analytics-end-date");

  if (startInput) {
    startInput.value = toInputDate(start);
  }

  if (endInput) {
    endInput.value = toInputDate(end);
  }
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function applyDateFilter() {
  const start = $("#analytics-start-date")?.value;
  const end = $("#analytics-end-date")?.value;

  if (!start || !end) {
    return;
  }

  if (start > end) {
    showError("Start date cannot be after end date.");
    return;
  }

  setAnalyticsDateRange(start, end);
}

function handleDatePreset(event) {
  const preset = event.target.value;

  if (!preset) {
    return;
  }

  const end = new Date();
  const start = new Date();

  if (preset === "7") {
    start.setDate(end.getDate() - 6);
  } else if (preset === "30") {
    start.setDate(end.getDate() - 29);
  } else if (preset === "90") {
    start.setDate(end.getDate() - 89);
  } else if (preset === "365") {
    start.setDate(end.getDate() - 364);
  } else {
    return;
  }

  const startInput = $("#analytics-start-date");
  const endInput = $("#analytics-end-date");

  if (startInput) {
    startInput.value = toInputDate(start);
  }

  if (endInput) {
    endInput.value = toInputDate(end);
  }

  setAnalyticsDateRange(toInputDate(start), toInputDate(end));
}

/* ============================================================
   LOADING
============================================================ */

function setLoading(loading) {
  state.loading = loading;

  const container = $(".analytics-page");

  if (!container) {
    return;
  }

  container.classList.toggle("is-loading", loading);
}

/* ============================================================
   ERROR
============================================================ */

function showError(message) {
  const error = $("#analytics-error");

  if (!error) {
    return;
  }

  error.textContent = message;
  error.hidden = false;

  window.setTimeout(() => {
    error.hidden = true;
  }, 5000);
}

/* ============================================================
   OVERVIEW CARDS
============================================================ */

function renderOverview(overview) {
  if (!overview) {
    return;
  }

  setText("#analytics-total-users", formatNumber(overview.total_users));

  setText("#analytics-active-users", formatNumber(overview.active_users));

  setText("#analytics-total-chats", formatNumber(overview.total_chats));

  setText("#analytics-total-messages", formatNumber(overview.total_messages));

  setText("#analytics-total-sessions", formatNumber(overview.total_sessions));

  setText(
    "#analytics-average-messages",
    Number(overview.average_messages_per_chat ?? 0).toFixed(2),
  );
}

function setText(selector, value) {
  const element = $(selector);

  if (element) {
    element.textContent = value;
  }
}

/* ============================================================
   CHAT ACTIVITY TABLE
============================================================ */

function renderChatActivity(data) {
  const body = $("#analytics-chat-activity-body");

  if (!body) {
    return;
  }

  if (!Array.isArray(data) || !data.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4">
          No chat activity found.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = data
    .map(
      (item) => `
        <tr>
          <td>
            ${escapeHtml(formatDate(item.date))}
          </td>

          <td>
            ${formatNumber(item.chats)}
          </td>

          <td>
            ${formatNumber(item.users)}
          </td>

          <td>
            ${formatNumber(item.messages)}
          </td>
        </tr>
      `,
    )
    .join("");
}

/* ============================================================
   TOP USERS
============================================================ */

function renderTopUsers(users) {
  const body = $("#analytics-top-users-body");

  if (!body) {
    return;
  }

  if (!Array.isArray(users) || !users.length) {
    body.innerHTML = `
      <tr>
        <td colspan="4">
          No user activity found.
        </td>
      </tr>
    `;

    return;
  }

  body.innerHTML = users
    .map(
      (user, index) => `
        <tr>
          <td>
            ${index + 1}
          </td>

          <td>
            ${escapeHtml(user.username)}
          </td>

          <td>
            ${formatNumber(user.chats)}
          </td>

          <td>
            ${formatNumber(user.messages)}
          </td>
        </tr>
      `,
    )
    .join("");
}

/* ============================================================
   HOURLY ACTIVITY
============================================================ */

function renderHourlyActivity(data) {
  const body = $("#analytics-hourly-body");

  if (!body) {
    return;
  }

  if (!Array.isArray(data)) {
    body.innerHTML = "";
    return;
  }

  body.innerHTML = data
    .map(
      (item) => `
        <tr>
          <td>
            ${String(item.hour).padStart(2, "0")}:00
          </td>

          <td>
            ${formatNumber(item.chats)}
          </td>
        </tr>
      `,
    )
    .join("");
}

/* ============================================================
   MAIN RENDER
============================================================ */

function render(data) {
  if (!data) {
    return;
  }

  state.data = data;

  renderOverview(data.overview);

  renderChatActivity(data.chatActivity);

  renderTopUsers(data.topUsers);

  renderHourlyActivity(data.hourlyActivity);
}

/* ============================================================
   EVENT BUS
============================================================ */

export function handleAnalyticsLoaded(data) {
  console.log("ANALYTICS CONTROLLER: loaded", data);

  render(data);
}

export function handleAnalyticsLoading({ loading }) {
  setLoading(loading);
}

export function handleAnalyticsError({ error }) {
  setLoading(false);

  showError(error?.message || "Failed to load analytics.");
}
