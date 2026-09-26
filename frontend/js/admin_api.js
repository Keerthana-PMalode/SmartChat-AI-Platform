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
