document.addEventListener("DOMContentLoaded", () => {


    /* ================= AUTH CHECK ================= */

    const role = localStorage.getItem("role");
    const token = localStorage.getItem("authToken");


    if (!token || role !== "user") {

        localStorage.clear();

        window.location.href = "login.html";

        return;

    }



    const chatBody = document.getElementById("chatBody");
    const input = document.getElementById("message");
    const button = document.getElementById("sendBtn");
    const typingIndicator = document.getElementById("typingIndicator");
    const logoutBtn = document.getElementById("logoutBtn");
    const filesBtn = document.getElementById("filesBtn");


    if (logoutBtn) {

        logoutBtn.addEventListener(
            "click",
            logout
        );

    }

    if (filesBtn) {

        filesBtn.addEventListener(
            "click",
            () => {

                window.location.href =
                    "files.html";

            }
        );

    }



    if (button) {

        button.addEventListener(
            "click",
            sendMessage
        );

    }



    if (input) {

        input.addEventListener(
            "keypress",
            function (e) {

                if (e.key === "Enter") {

                    sendMessage();

                }

            }
        );

    }



    /* ================= TYPING INDICATOR ================= */


    function showTyping() {

        if (typingIndicator) {

            typingIndicator.classList.remove("hidden");

        }

    }



    function hideTyping() {

        if (typingIndicator) {

            typingIndicator.classList.add("hidden");

        }

    }




    /* ================= SEND MESSAGE ================= */


    async function sendMessage() {


        const message =
            input.value.trim();



        if (message === "") {

            return;

        }



        appendUser(message);


        input.value = "";



        showTyping();



        try {


            const response =
                await fetch(
                    "/rasa/webhooks/rest/webhook",
                    {

                        method: "POST",

                        headers: {

                            "Content-Type": "application/json",

                            "Authorization": "Bearer " + localStorage.getItem("authToken")

                        },

                        body: JSON.stringify({

                            sender:
                                localStorage.getItem("username"),

                            message:
                                message,

                            metadata: {

                                Authorization:
                                    "Bearer " + localStorage.getItem("authToken")

                            }

                        })

                    }
                );



            if (!response.ok) {

                throw new Error(
                    "Bot API failed"
                );

            }



            const data =
                await response.json();



            hideTyping();



            if (data.length > 0) {


                for (const msg of data) {

                    if (!msg.text) {
                        continue;
                    }

                    appendBot(msg.text);
                    await fetch("/auth/chat/history", {

                        method: "POST",

                        headers: {

                            "Content-Type": "application/json",

                            "Authorization":
                                "Bearer " + localStorage.getItem("authToken")

                        },

                        body: JSON.stringify({

                            session_id:
                                localStorage.getItem("username"),

                            sender:
                                "user",

                            message:
                                message,

                            response:
                                msg.text

                        })

                    });

                }
            }
            else {


                appendBot(
                    "No response from bot."
                );


            }



        }
        catch (error) {


            console.error(
                "Chat error:",
                error
            );


            hideTyping();


            appendBot(
                "Unable to connect to server."
            );


        }


    }




    /* ================= USER MESSAGE ================= */


    function appendUser(message) {


        const wrapper =
            document.createElement("div");


        wrapper.className =
            "user-message";



        const bubble =
            document.createElement("div");


        bubble.className =
            "bubble";



        bubble.innerHTML = `

            ${message}

            <div class="timestamp">
                ${getTime()}
            </div>

        `;



        wrapper.appendChild(bubble);


        chatBody.appendChild(wrapper);



        scrollBottom();


    }




    /* ================= BOT MESSAGE ================= */


    function appendBot(message) {


        const wrapper =
            document.createElement("div");


        wrapper.className =
            "bot-message";



        const bubble =
            document.createElement("div");


        bubble.className =
            "bubble";



        wrapper.appendChild(bubble);


        chatBody.appendChild(wrapper);



        scrollBottom();



        simulateTyping(
            bubble,
            message
        );


    }




    /* ================= TYPING ANIMATION ================= */


    async function simulateTyping(
        element,
        message
    ) {


        element.innerHTML = "";



        const words =
            message.split(" ");



        for (
            let i = 0;
            i < words.length;
            i++
        ) {


            element.innerHTML +=
                words[i] + " ";



            scrollBottom();



            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        120 + Math.random() * 80
                    )
            );


        }



        element.innerHTML += `

            <div class="timestamp">
                ${getTime()}
            </div>

        `;


    }





    /* ================= SCROLL ================= */


    function scrollBottom() {


        chatBody.scrollTop =
            chatBody.scrollHeight;


    }





    /* ================= TIME ================= */


    function getTime() {


        const now =
            new Date();



        let hours =
            now.getHours();



        let minutes =
            now.getMinutes();



        minutes =
            minutes < 10
                ? "0" + minutes
                : minutes;



        return `${hours}:${minutes}`;


    }




});





/* ================= LOGOUT ================= */


function logout() {


    localStorage.removeItem(
        "authToken"
    );


    localStorage.removeItem(
        "username"
    );


    localStorage.removeItem(
        "role"
    );



    window.location.href =
        "login.html";

}