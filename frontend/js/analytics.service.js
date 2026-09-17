import { api } from "./admin_api.js";
import { EventBus } from "./admin_events.js";

let currentStartDate = "";
let currentEndDate = "";

function buildQueryParams(startDate, endDate) {
  const params = new URLSearchParams();

  if (startDate) {
    params.set("start_date", startDate);
  }

  if (endDate) {
    params.set("end_date", endDate);
  }

  return params;
}

async function fetchEndpoint(endpoint) {
  const params = buildQueryParams(currentStartDate, currentEndDate);

  const query = params.toString();

  const url = `/admin/analytics/${endpoint}${query ? `?${query}` : ""}`;

  console.log("ANALYTICS REQUEST:", url);

  try {
    const response = await api.get(url);

    console.log(`ANALYTICS RESPONSE [${endpoint}]:`, response);

    return response;
  } catch (error) {
    console.error(`ANALYTICS ERROR [${endpoint}]:`, error);

    throw error;
  }
}

/* ============================================================
   DATE RANGE
============================================================ */

export function setAnalyticsDateRange(startDate, endDate) {
  currentStartDate = startDate ?? "";
  currentEndDate = endDate ?? "";

  return fetchAnalytics();
}

export function getAnalyticsDateRange() {
  return {
    startDate: currentStartDate,
    endDate: currentEndDate,
  };
}

/* ============================================================
   FETCH ALL ANALYTICS
============================================================ */

export async function fetchAnalytics() {
  EventBus.emit("analytics:loading", {
    loading: true,
  });

  try {
    const [
      overview,
      chatActivity,
      messageActivity,
      topUsers,
      chatStatistics,
      hourlyActivity,
    ] = await Promise.all([
      fetchEndpoint("overview"),
      fetchEndpoint("chat-activity"),
      fetchEndpoint("message-activity"),
      fetchEndpoint("top-users", {
        limit: 10,
      }),
      fetchEndpoint("chat-statistics"),
      fetchEndpoint("hourly-activity"),
    ]);

    const data = {
      overview,
      chatActivity,
      messageActivity,
      topUsers,
      chatStatistics,
      hourlyActivity,
    };

    EventBus.emit("analytics:loaded", data);

    return data;
  } catch (error) {
    console.error("Failed to fetch analytics:", error);

    EventBus.emit("analytics:error", {
      error,
    });

    throw error;
  } finally {
    EventBus.emit("analytics:loading", {
      loading: false,
    });
  }
}

/* ============================================================
   REFRESH
============================================================ */

export function refreshAnalytics() {
  return fetchAnalytics();
}

/* ============================================================
   EXPORT
============================================================ */

export async function exportAnalytics() {
  EventBus.emit("analytics:exporting", {
    exporting: true,
  });

  try {
    const data = await fetchAnalytics();

    const rows = [];

    rows.push(["Metric", "Value"]);

    rows.push(["Total Users", data.overview.total_users]);

    rows.push(["Active Users", data.overview.active_users]);

    rows.push(["Total Chats", data.overview.total_chats]);

    rows.push(["Total Sessions", data.overview.total_sessions]);

    rows.push(["Total Messages", data.overview.total_messages]);

    rows.push([
      "Average Messages Per Chat",
      data.overview.average_messages_per_chat,
    ]);

    rows.push(["", ""]);

    rows.push(["Date", "Chats", "Users", "Sessions"]);

    data.chatActivity.forEach((item) => {
      rows.push([item.date, item.chats, item.users, item.sessions]);
    });

    rows.push(["", "", "", ""]);

    rows.push(["Top User", "Chats", "Messages"]);

    data.topUsers.forEach((user) => {
      rows.push([user.username, user.chats, user.messages]);
    });

    function escapeCsvValue(value) {
      return `"${String(value ?? "").replace(/"/g, '""')}"`;
    }

    const csv = rows
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\r\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = `analytics-${new Date().toISOString().slice(0, 10)}.csv`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    EventBus.emit("analytics:exported", {
      data,
    });

    return data;
  } catch (error) {
    console.error("Failed to export analytics:", error);

    EventBus.emit("analytics:export-error", {
      error,
    });

    throw error;
  } finally {
    EventBus.emit("analytics:exporting", {
      exporting: false,
    });
  }
}
