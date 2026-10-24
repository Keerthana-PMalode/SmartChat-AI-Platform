function decodeJWT(token) {
  try {
    const payload = token.split(".")[1];

    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch (err) {
    console.error("Invalid JWT:", err);
    return null;
  }
}


function handleLoginSuccess(data, username) {
  localStorage.setItem("authToken", data.access_token);
  localStorage.setItem("username", username);

  const payload = decodeJWT(data.access_token);

  if (!payload || !payload.role) {
    localStorage.clear();
    throw new Error("Invalid token or missing role");
  }

  const serverRole = String(payload.role).toLowerCase();

  localStorage.setItem("role", serverRole);

  console.log("JWT Payload:", payload);
  console.log("Authenticated role:", serverRole);

  // Return the role; do not redirect here.
  return serverRole;
}

