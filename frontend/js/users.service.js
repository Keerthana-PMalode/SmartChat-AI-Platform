import { api } from "./admin_api.js";
import { EventBus } from "./admin_events.js";

let usersCache = null;
let isLoading = false;

/* =========================
   FETCH USERS
========================= */
export async function fetchUsers(forceRefresh = false) {

    if (isLoading) return;

    if (usersCache && !forceRefresh) {
        EventBus.emit("users:loaded", { users: usersCache });
        return;
    }

    isLoading = true;
    EventBus.emit("users:loading", { loading: true });

    try {
        const users = await api.get("/admin/users");

        usersCache = users;

        EventBus.emit("users:loaded", { users });

    } catch (error) {
        EventBus.emit("users:error", {
            message: error.message
        });

    } finally {
        isLoading = false;
        EventBus.emit("users:loading", { loading: false });
    }
}

/* =========================
   CREATE USER
========================= */
export async function handleCreateUser(payload) {
    try {
        const newUser = await api.post("/admin/users", payload);

        usersCache = null;

        EventBus.emit("users:created", {
            user: newUser
        });

        await fetchUsers(true);

    } catch (err) {
        EventBus.emit("users:error", {
            message: err.message
        });
    }
}

/* =========================
   DELETE USER
========================= */
export async function deleteUser(userId) {
    try {
        await api.delete(`/admin/users/${userId}`);

        usersCache = null;

        await fetchUsers(true);

    } catch (error) {
        EventBus.emit("users:error", {
            message: error.message
        });

        throw error;
    }
}