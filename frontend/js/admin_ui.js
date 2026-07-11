import { EventBus } from "./admin_events.js";
import { modalManager } from "./modal_manager.js";

let uiInitialized = false;

/* =========================
   INIT UI
========================= */
function initUI() {

    if (uiInitialized) {
        console.warn("UI already initialized");
        return;
    }

    uiInitialized = true;

    console.log("initUI started");

    document.body.classList.add("fade-in");

    console.log("Calling setupSidebarNavigation()");
    setupSidebarNavigation();

    console.log("Calling setupLogout()");
    setupLogout();

    const initialSection =
        window.location.hash.substring(1) || "dashboard";
    showContentPanel(initialSection);

    console.log("Initial section:", initialSection);

    highlightActiveSection(initialSection);
    console.log("highlightActiveSection() completed");

    showContentPanel(initialSection);
    console.log("showContentPanel() completed");

    updatePageTitle(initialSection);
    console.log("updatePageTitle() completed");

    window.addEventListener("hashchange", onHashChange);
    console.log("hashchange listener registered");

    EventBus.on("app:navigated", handleNavigation);
    console.log("app:navigated listener registered");

    EventBus.on("app:loggedout", handleLogout);
    console.log("app:loggedout listener registered");

    console.log("initUI completed");
}
console.log("Registering app:ready listener");

EventBus.on("app:ready", () => {
    console.log("app:ready received");
    initUI();
});


/* =========================
   NAVIGATION UI
========================= */
function setupSidebarNavigation() {

    const navItems =
        document.querySelectorAll(
            ".nav-item:not(.logout)"
        );

    console.log("Navigation UI");

    navItems.forEach(item => {

        item.addEventListener(
            "click",
            e => {
                e.preventDefault();
                const section = item.dataset.section;
                navItems.forEach(nav =>
                    nav.classList.remove("active")
                );

                item.classList.add(
                    "active"
                );

                window.location.hash =
                    section;


                EventBus.emit(
                    "app:navigate",
                    {
                        section
                    }
                );

            }
        );

    });

}



function onHashChange() {

    const section =
        window.location.hash.replace("#", "")
        || "dashboard";


    EventBus.emit(
        "app:navigate",
        {
            section
        }
    );

}



function handleNavigation(e) {

    const section =
        e.detail.section;


    highlightActiveSection(
        section
    );


    showContentPanel(
        section
    );


    updatePageTitle(
        section
    );

}



function highlightActiveSection(section) {

    const navItems =
        document.querySelectorAll(
            ".nav-item:not(.logout)"
        );


    navItems.forEach(item =>
        item.classList.remove("active")
    );


    document
        .querySelector(
            `[data-section="${section}"]`
        )
        ?.classList.add("active");

}



function showContentPanel(section) {

    console.log("========== showContentPanel ==========");
    console.log("Requested section:", section);

    const panels = document.querySelectorAll(".content-panel");

    console.log("Number of panels:", panels.length);

    panels.forEach(panel => {
        console.log("Hiding:", panel.id);
        panel.classList.add("hidden");
    });

    const panel =
        document.querySelector(`#${section}-panel`) ||
        document.querySelector("#dashboard-panel");

    console.log("Selected panel:", panel);

    if (!panel) {
        console.error("No panel found!");
        return;
    }

    panel.classList.remove("hidden");
    console.log(panel.offsetWidth);
    console.log(panel.offsetHeight);
    console.log(panel.getBoundingClientRect()); 

    console.log(
        "Hidden class after remove:",
        panel.classList.contains("hidden")
    );

    console.log(
        "Computed display:",
        getComputedStyle(panel).display
    );

    console.log(
        "Computed visibility:",
        getComputedStyle(panel).visibility
    );

    console.log("=====================================");
}



function updatePageTitle(section) {

    const pageTitle =
        document.getElementById(
            "page-title"
        );


    if (!pageTitle)
        return;


    const titles = {

        dashboard: "Dashboard",
        users: "Users",
        "chat-history": "Chat History",
        analytics: "Analytics",
        settings: "Settings",
        logs: "Logs"

    };


    pageTitle.textContent =
        titles[section] || "Dashboard";

}

/* =========================
   USERS UI RENDERING
========================= */

EventBus.on(
    "users:loading",
    e => {

        const tbody =
            document.getElementById(
                "users-tbody"
            );


        if (!tbody)
            return;


        if (e.detail?.loading) {

            tbody.innerHTML =
                `
                <tr>
                    <td colspan="5">
                        Loading...
                    </td>
                </tr>
                `;

        }

    }
);



EventBus.on(
    "users:loaded",
    e => {

        const users =
            e.detail?.users;


        const tbody =
            document.getElementById(
                "users-tbody"
            );


        if (
            !tbody ||
            !Array.isArray(users)
        )
            return;



        tbody.innerHTML =
            users.map(user =>

            `
            <tr>

                <td>
                    ${user.id}
                </td>

                <td>
                    ${user.name || user.username}
                </td>

                <td>
                    ${user.email || "-"}
                </td>

                <td>
                    ${user.role || "-"}
                </td>

                <td>

                    <button class="delete-btn"
                            data-id="${user.id}">

                        Delete

                    </button>

                </td>

            </tr>
            `

        ).join("");

    }
);




/* =========================
   DELETE HANDLER
========================= */

document.addEventListener(
    "click",
    async e => {


        const btn =
            e.target.closest(
                ".delete-btn"
            );


        if (!btn)
            return;



        const confirmed =
            await modalManager.confirm({

                modalId:
                    "confirm-modal",

                title:
                    "Delete User",

                message:
                    "Are you sure you want to delete this user?",

                confirmText:
                    "Delete",

                cancelText:
                    "Cancel"

            });



        if (!confirmed)
            return;



        EventBus.emit(
            "users:delete-requested",
            {
                userId:
                    btn.dataset.id
            }
        );


    }
);





/* =========================
   LOGOUT
========================= */

function setupLogout() {

    const logoutBtn =
        document.getElementById(
            "logout-btn"
        );


    console.log(
        "Logout button:",
        logoutBtn
    );


    if (!logoutBtn) {

        console.warn(
            "Logout button not found"
        );

        return;

    }



    logoutBtn.addEventListener(
        "click",
        async e => {

            console.log(
                "Logout clicked"
            );


            e.preventDefault();



            const confirmed =
                await modalManager.confirm({

                    modalId:
                        "confirm-modal",

                    title:
                        "Logout",

                    message:
                        "Are you sure you want to logout?",

                    confirmText:
                        "Logout",

                    cancelText:
                        "Stay"

                });



            console.log(
                "confirmed =",
                confirmed
            );



            if (confirmed) {

                EventBus.emit(
                    "app:logout"
                );

            }

        }
    );

}




function handleLogout() {

    document.body.classList.add(
        "fade-out"
    );


    setTimeout(
        () => {

            window.location.href =
                "/login.html";

        },
        500
    );

}





/* =========================
   CREATE USER
========================= */

document
    .getElementById("create-user-btn")
    ?.addEventListener(
        "click",
        () => {

            openCreateUserDialog();

        }
    );



function openCreateUserDialog() {

    const username =
        prompt(
            "Enter username:"
        );


    if (!username)
        return;



    const password =
        prompt(
            "Enter password:"
        );


    if (!password)
        return;



    const role =
        prompt(
            "Enter role (admin/user):",
            "user"
        );



    EventBus.emit(
        "users:create-requested",
        {
            username,
            password,
            role
        }
    );

}


/* =========================
   CHAT HISTORY UI RENDERING
========================= */

EventBus.on(
    "chat-history:loaded",
    e => {


        const chats =
            e.detail?.chats;


        const tbody =
            document.getElementById(
                "chat-history-tbody"
            );


        if (
            !tbody ||
            !Array.isArray(chats)
        )
            return;



        tbody.innerHTML =
            chats.map(chat =>

            `
            <tr>

                <td>
                    ${chat.id}
                </td>


                <td>
                    ${chat.user}
                </td>


                <td>
                    ${chat.date}
                </td>


                <td>
                    ${chat.messages}
                </td>


                <td>
                    ${chat.status}
                </td>


                <td>

                    <button class="view-chat-btn"
                            data-id="${chat.id}">

                        View

                    </button>


                </td>


            </tr>
            `

        ).join("");

    }
);


/* =========================
   LOGS UI RENDERING
========================= */

EventBus.on(
    "logs:loaded",
    e => {

        const logs =
            e.detail?.logs;


        const tbody =
            document.getElementById(
                "logs-tbody"
            );


        if (
            !tbody ||
            !Array.isArray(logs)
        )
            return;



        tbody.innerHTML =
            logs.map(log =>

            `
            <tr>

                <td>
                    ${log.timestamp}
                </td>


                <td>
                    ${log.user}
                </td>


                <td>
                    ${log.action}
                </td>


            </tr>
            `

        ).join("");

    }
);
