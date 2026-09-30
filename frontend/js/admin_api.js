const API_CONFIG = {
  BASE_URL: "/auth",
  TIMEOUT: 10000,
  RETRIES: 1,
};

/* =========================
AUTH TOKEN
========================= */

function getToken() {
  return localStorage.getItem("authToken");
}

function clearToken() {
  localStorage.removeItem("authToken");
}

/* =========================
API REQUEST
========================= */

async function request(endpoint, options = {}) {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;

  console.log("Request URL:", url);

  const retries = options.retries ?? API_CONFIG.RETRIES;

  let attempt = 0;

  while (attempt <= retries) {
    const controller = new AbortController();

    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

    try {
      const token = getToken();

      const response = await fetch(url, {
        method: options.method || "GET",

        headers: {
          "Content-Type": "application/json",

          ...(token && {
            Authorization: `Bearer ${token}`,
          }),

          ...(options.headers || {}),
        },

        body:
          options.body !== undefined && options.body !== null
            ? JSON.stringify(options.body)
            : null,

        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await handleResponse(response);

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      const isLastAttempt = attempt === retries;

      const shouldRetryRequest =
        isRetryable(error) && (options.method || "GET").toUpperCase() === "GET";

      if (!isLastAttempt && shouldRetryRequest) {
        attempt++;
        continue;
      }

      handleError(error);
      throw error;
    }
  }
}

/* =========================
RETRY HANDLING
========================= */

function isRetryable(error) {
  return (
    error?.name === "AbortError" || error?.message?.includes("Failed to fetch")
  );
}

/* =========================
RESPONSE HANDLING
========================= */

async function handleResponse(response) {
  if (response.status === 401) {
    clearToken();
    window.location.href = "/login.html";

    const error = new Error("Unauthorized");
    error.status = 401;

    throw error;
  }

  if (!response.ok) {
    let errorData = null;

    try {
      errorData = await response.json();
    } catch {
      // Response was not JSON.
    }

    const error = new Error(
      errorData?.detail
        ? formatApiError(errorData.detail)
        : `API request failed with status ${response.status}`,
    );

    // Important: controllers can now inspect error.status.
    error.status = response.status;

    // Preserve the original FastAPI validation response.
    error.data = errorData;

    throw error;
  }

  // Handle successful responses with no body.
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/* =========================
API ERROR FORMATTING
========================= */

function formatApiError(detail) {
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const location = Array.isArray(item.loc) ? item.loc.join(".") : "";

        return location ? `${location}: ${item.msg}` : item.msg;
      })
      .join("; ");
  }

  if (typeof detail === "string") {
    return detail;
  }

  return "API request failed.";
}

/* =========================
ERROR LOGGING
========================= */

function handleError(error) {
  console.error("API Error:", {
    status: error?.status,
    message: error?.message,
    data: error?.data,
  });
}

/* =========================
API CLIENT
========================= */

export const api = {
  get(endpoint) {
    return request(endpoint, {
      method: "GET",
    });
  },

  post(endpoint, body) {
    return request(endpoint, {
      method: "POST",
      body,
    });
  },

  put(endpoint, body) {
    return request(endpoint, {
      method: "PUT",
      body,
    });
  },

  patch(endpoint, body) {
    return request(endpoint, {
      method: "PATCH",
      body,
    });
  },

  delete(endpoint) {
    return request(endpoint, {
      method: "DELETE",
    });
  },
};

/* =========================
ADMIN SETTINGS API
========================= */

export async function getSettings() {
  return api.get("/admin/settings");
}

export async function updateSettings(payload) {
  return api.put("/admin/settings", payload);
}

/* =========================
ADMIN LOGS API
========================= */

/**
 * Fetch system audit logs.
 *
 * @param {Object} params
 * @param {number} params.page
 * @param {number} params.pageSize
 * @param {string} params.level
 * @param {string} params.search
 */
export async function getLogs({
  page = 1,
  pageSize = 50,
  level = "all",
  search = "",
} = {}) {
  const query = new URLSearchParams();

  query.set("page", String(page));
  query.set("page_size", String(pageSize));

  if (level && level.toLowerCase() !== "all") {
    query.set("level", level.toLowerCase());
  }

  if (search && search.trim()) {
    query.set("search", search.trim());
  }

  return api.get(`/admin/logs?${query.toString()}`);
}

/**
 * Export system audit logs as CSV.
 *
 * This cannot use api.get() because the response
 * is a CSV file rather than JSON.
 */
export async function exportLogs({ level = "all", search = "" } = {}) {
  const query = new URLSearchParams();

  if (level && level.toLowerCase() !== "all") {
    query.set("level", level.toLowerCase());
  }

  if (search && search.trim()) {
    query.set("search", search.trim());
  }

  const token = getToken();

  const url = `${API_CONFIG.BASE_URL}/admin/logs/export?${query.toString()}`;

  const controller = new AbortController();

  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

  try {
    const response = await fetch(url, {
      method: "GET",

      headers: {
        ...(token && {
          Authorization: `Bearer ${token}`,
        }),
      },

      signal: controller.signal,
    });

    if (response.status === 401) {
      clearToken();

      window.location.href = "/login.html";

      const error = new Error("Unauthorized");

      error.status = 401;

      throw error;
    }

    if (!response.ok) {
      let errorData = null;

      try {
        errorData = await response.json();
      } catch {
        // Response was not JSON.
      }

      const error = new Error(
        errorData?.detail
          ? formatApiError(errorData.detail)
          : `API request failed with status ${response.status}`,
      );

      error.status = response.status;
      error.data = errorData;

      throw error;
    }

    return await response.blob();
  } finally {
    clearTimeout(timeoutId);
  }
}
