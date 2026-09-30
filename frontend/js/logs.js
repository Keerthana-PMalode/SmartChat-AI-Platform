import { EventBus } from "./admin_events.js";

import { getLogs, exportLogs as exportLogsApi } from "./admin_api.js";

/* =========================================================
   LOGS STATE
========================================================= */

const state = {
  page: 1,
  pageSize: 50,
  level: "all",
  search: "",
  total: 0,
  totalPages: 1,
  loading: false,
};

/* =========================================================
   GET CURRENT STATE
========================================================= */

function getState() {
  return {
    ...state,
  };
}

/* =========================================================
   LOAD LOGS
========================================================= */

export async function fetchLogs({
  page = state.page,
  level = state.level,
  search = state.search,
} = {}) {
  if (state.loading) {
    return;
  }

  state.loading = true;

  state.page = page;
  state.level = level;
  state.search = search;

  EventBus.emit("logs:loading", {
    loading: true,
  });

  try {
    const data = await getLogs({
      page: state.page,
      pageSize: state.pageSize,
      level: state.level,
      search: state.search,
    });

    const items = data?.items ?? [];

    state.total = data?.total ?? 0;

    state.totalPages = data?.total_pages ?? 1;

    state.page = data?.page ?? state.page;

    state.pageSize = data?.page_size ?? state.pageSize;

    EventBus.emit("logs:loaded", {
      logs: items,
      page: state.page,
      pageSize: state.pageSize,
      total: state.total,
      totalPages: state.totalPages,
      level: state.level,
      search: state.search,
    });

    return data;
  } catch (error) {
    console.error("LOGS: failed to load logs:", error);

    EventBus.emit("logs:error", {
      error,
      message: error?.message || "Failed to load system logs.",
    });

    throw error;
  } finally {
    state.loading = false;

    EventBus.emit("logs:loading", {
      loading: false,
    });
  }
}

/* =========================================================
   INITIAL LOAD
========================================================= */

export async function loadLogs() {
  state.page = 1;

  return fetchLogs({
    page: 1,
    level: state.level,
    search: state.search,
  });
}

/* =========================================================
   REFRESH
========================================================= */

export async function refreshLogs() {
  return fetchLogs({
    page: state.page,
    level: state.level,
    search: state.search,
  });
}

/* =========================================================
   SEARCH
========================================================= */

export async function searchLogs(search) {
  state.search = String(search ?? "").trim();

  state.page = 1;

  return fetchLogs({
    page: 1,
    level: state.level,
    search: state.search,
  });
}

/* =========================================================
   LEVEL FILTER
========================================================= */

export async function filterLogsByLevel(level) {
  const normalizedLevel = String(level ?? "all")
    .trim()
    .toLowerCase();

  const allowedLevels = new Set(["all", "info", "warning", "error"]);

  state.level = allowedLevels.has(normalizedLevel) ? normalizedLevel : "all";

  state.page = 1;

  return fetchLogs({
    page: 1,
    level: state.level,
    search: state.search,
  });
}

/* =========================================================
   PAGINATION
========================================================= */

export async function setLogsPage(page) {
  const requestedPage = Number(page);

  if (!Number.isInteger(requestedPage)) {
    return;
  }

  if (requestedPage < 1) {
    return;
  }

  if (requestedPage > state.totalPages) {
    return;
  }

  if (requestedPage === state.page) {
    return;
  }

  return fetchLogs({
    page: requestedPage,
    level: state.level,
    search: state.search,
  });
}

/* =========================================================
   EXPORT
========================================================= */

export async function exportLogs() {
  EventBus.emit("logs:exporting", {
    level: state.level,
    search: state.search,
  });

  try {
    const blob = await exportLogsApi({
      level: state.level,
      search: state.search,
    });

    const url = window.URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "system_logs.csv";

    document.body.appendChild(link);

    link.click();

    link.remove();

    window.URL.revokeObjectURL(url);

    EventBus.emit("logs:exported", {
      message: "System logs exported successfully.",
    });
  } catch (error) {
    console.error("LOGS: export failed:", error);

    EventBus.emit("logs:export-error", {
      error,
      message: error?.message || "Failed to export system logs.",
    });

    throw error;
  }
}

/* =========================================================
   EVENT BUS WIRING
========================================================= */

/**
 * Logs section requests its initial data.
 */
EventBus.on("logs:load-requested", async () => {
  try {
    await loadLogs();
  } catch (error) {
    console.error("LOGS: initial load failed:", error);
  }
});

/**
 * Refresh logs.
 */
EventBus.on("logs:refresh-requested", async () => {
  try {
    await refreshLogs();
  } catch (error) {
    console.error("LOGS: refresh failed:", error);
  }
});

/**
 * Search logs.
 */
EventBus.on("logs:search-requested", async (event) => {
  const search = event.detail?.search ?? "";

  try {
    await searchLogs(search);
  } catch (error) {
    console.error("LOGS: search failed:", error);
  }
});

/**
 * Change log level.
 */
EventBus.on("logs:level-requested", async (event) => {
  const level = event.detail?.level ?? "all";

  try {
    await filterLogsByLevel(level);
  } catch (error) {
    console.error("LOGS: level filter failed:", error);
  }
});

/**
 * Change page.
 */
EventBus.on("logs:page-requested", async (event) => {
  const page = event.detail?.page;

  try {
    await setLogsPage(page);
  } catch (error) {
    console.error("LOGS: pagination failed:", error);
  }
});

/**
 * Export logs.
 */
EventBus.on("logs:export-requested", async () => {
  try {
    await exportLogs();
  } catch (error) {
    console.error("LOGS: export request failed:", error);
  }
});

/* =========================================================
   PUBLIC STATE ACCESS
========================================================= */

export function getLogsState() {
  return getState();
}
