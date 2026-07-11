const token =
    localStorage.getItem(
        "authToken"
    );
const role =
    localStorage.getItem(
        "role"
    );
if (!token || role !== "user") {
    window.location.href =
        "login.html";
}
export async function fileRequest(
    url,
    options = {}
) {
    const token =
        localStorage.getItem(
            "authToken"
        );
    return fetch(
        "http://localhost:8001" + url,
        {
            ...options,
            headers: {
                "Authorization":
                    "Bearer " + token,
                ...(options.headers || {})
            }
        }
    );
}