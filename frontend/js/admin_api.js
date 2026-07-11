const API_CONFIG = {
    BASE_URL: "http://localhost:8000",
    TIMEOUT: 10000,
    RETRIES: 1
};

function getToken() {
    return localStorage.getItem("authToken");
}

function clearToken() {
    localStorage.removeItem("authToken");
}

async function request(endpoint, options = {}) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    console.log("Request URL:", url);
    const retries = options.retries ?? API_CONFIG.RETRIES;

    let attempt = 0;

    while (attempt <= retries) {
        const controller = new AbortController();

        const timeoutId = setTimeout(
            () => controller.abort(),
            API_CONFIG.TIMEOUT
        );

        try {
            const token = getToken();

            const response = await fetch(url, {
                method: options.method || "GET",
                headers: {
                    "Content-Type": "application/json",
                    ...(token && {
                        Authorization: `Bearer ${token}`
                    }),
                    ...(options.headers || {})
                },
                body: options.body
                    ? JSON.stringify(options.body)
                    : null,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const data = await handleResponse(response);

            return data; // success → exit loop

        } catch (error) {
            clearTimeout(timeoutId);

            const isLastAttempt = attempt === retries;
            const shouldRetryRequest =
                isRetryable(error) &&
                options.method === "GET";

            if (!isLastAttempt && shouldRetryRequest) {
                attempt++;
                continue;
            }

            handleError(error);
            throw error;
        }
    }
}

function isRetryable(error) {
    return (
        error.name === "AbortError" || // timeout
        error.message.includes("Failed to fetch") // network
    );
}

async function handleResponse(response) {
    if (response.status === 401) {
        clearToken();
        window.location.href = "/login.html";
        throw new Error("Unauthorized");
    }

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "API Error");
    }

    return response.json();
}

function handleError(error) {
    console.error("API Error:", error.message);
}

export const api = {
    get(endpoint) {
        return request(endpoint, { method: "GET" });
    },

    post(endpoint, body) {
        return request(endpoint, {
            method: "POST",
            body
        });
    },

    put(endpoint, body) {
        return request(endpoint, {
            method: "PUT",
            body
        });
    },

    patch(endpoint, body) {
        return request(endpoint, {
            method: "PATCH",
            body
        });
    },

    delete(endpoint) {
        return request(endpoint, {
            method: "DELETE"
        });
    }
};