function decodeJWT(token) {
    try {
        const payload = token.split(".")[1];

        return JSON.parse(
            atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        );
    } catch (err) {
        console.error("Invalid JWT:", err);
        return null;
    }
}

function handleLoginSuccess(data, username) {
    localStorage.setItem("authToken", data.access_token);
    localStorage.setItem("username", username);

    const payload = decodeJWT(data.access_token);

    if (!payload) {
        throw new Error("Invalid token");
    }

    localStorage.setItem("role", payload.role);

    console.log("JWT Payload:", payload);

    if (payload.role === "admin") {
        window.location.href = "admin.html";
    } else {
        window.location.href = "chat.html";
    }
}

