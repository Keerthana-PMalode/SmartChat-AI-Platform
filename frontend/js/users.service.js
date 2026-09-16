import { api } from "./admin_api.js";
import { EventBus } from "./admin_events.js";

let usersCache = null;
let isLoading = false;

/* =========================================================
   USER SEARCH STATE
========================================================= */

/**
 * Current Users search query.
 *
 * Empty string means:
 *
 *     show all users
 */
let currentSearch = "";

/* =========================================================
   FETCH USERS
========================================================= */

/**
 * Fetch Users from the API.
 *
 * @param {boolean} forceRefresh
 *   true  = always request fresh data
 *   false = use cache when available
 *
 * @param {string|null} search
 *   When provided, updates the current search.
 *   When omitted/null, the existing search is preserved.
 */
export async function fetchUsers(forceRefresh = false, search = null) {
  if (isLoading) {
    return;
  }

  /* -------------------------------------------------------
     UPDATE SEARCH STATE
  ------------------------------------------------------- */

  if (search !== null) {
    currentSearch = String(search).trim();
  }

  /* -------------------------------------------------------
     CACHE
  ------------------------------------------------------- */

  /*
   * Only use the cache when:
   *
   * 1. this is not an explicit refresh
   * 2. there is no active search
   *
   * Search results should always be calculated
   * from the current server data.
   */
  if (usersCache && !forceRefresh && currentSearch === "") {
    EventBus.emit("users:loaded", {
      users: usersCache,
      search: currentSearch,
    });

    return;
  }

  isLoading = true;

  EventBus.emit("users:loading", {
    loading: true,
  });

  try {
    /*
     * Fetch all users.
     *
     * The filtering is performed below so that
     * the Users UI has the same behavior regardless
     * of whether the backend currently supports
     * a search parameter.
     */
    const users = await api.get("/admin/users");

    const sortedUsers = [...users].sort((a, b) => a.id - b.id);

    usersCache = sortedUsers;

    /* -----------------------------------------------------
       APPLY SEARCH
    ----------------------------------------------------- */

    const normalizedSearch = currentSearch.toLowerCase();

    const filteredUsers =
      normalizedSearch === ""
        ? sortedUsers
        : sortedUsers.filter((user) => {
            const username = String(user.username ?? "").toLowerCase();

            const role = String(user.role ?? "").toLowerCase();

            const id = String(user.id ?? "").toLowerCase();

            return (
              username.includes(normalizedSearch) ||
              role.includes(normalizedSearch) ||
              id.includes(normalizedSearch)
            );
          });

    /* -----------------------------------------------------
       PUBLISH RESULTS
    ----------------------------------------------------- */

    EventBus.emit("users:loaded", {
      users: filteredUsers,
      search: currentSearch,
    });
  } catch (error) {
    EventBus.emit("users:error", {
      message: error.message,
    });
  } finally {
    isLoading = false;

    EventBus.emit("users:loading", {
      loading: false,
    });
  }
}

/* =========================================================
   CREATE USER
========================================================= */

/**
 * Create a new user.
 */
export async function handleCreateUser(payload) {
  try {
    const newUser = await api.post("/admin/users", payload);

    /*
     * Invalidate cached data because
     * the Users collection changed.
     */
    usersCache = null;

    EventBus.emit("users:created", {
      user: newUser,
    });

    /*
     * Reload using the current search state.
     *
     * This keeps the Users page consistent if
     * the administrator currently has a search active.
     */
    await fetchUsers(true);
  } catch (error) {
    EventBus.emit("users:error", {
      message: error.message,
    });
  }
}

/* =========================================================
   DELETE USER
========================================================= */

/**
 * Delete a user.
 */
export async function deleteUser(userId) {
  try {
    await api.delete(`/admin/users/${userId}`);

    /*
     * Invalidate cached data because
     * the Users collection changed.
     */
    usersCache = null;

    /*
     * Reload using the current search state.
     */
    await fetchUsers(true);
  } catch (error) {
    EventBus.emit("users:error", {
      message: error.message,
    });

    throw error;
  }
}
