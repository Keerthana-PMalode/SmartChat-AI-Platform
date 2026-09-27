document.addEventListener("DOMContentLoaded", async () => {
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

  const applicationName = document.getElementById("applicationName");
  const pageTitle = document.getElementById("pageTitle");
  const messageCounter = document.getElementById("messageCounter");

  /* ================= DEFAULT SETTINGS ================= */

  const DEFAULT_SETTINGS = {
    application_name: "ChatBot",
    max_message_length: 5000,
    maintenance_mode: false,
    allow_user_registration: true,
  };

  let appSettings = {
    ...DEFAULT_SETTINGS,
  };

  /* ================= SETTINGS ================= */

  async function loadSettings() {
    try {
      const response = await fetch("/auth/admin/settings/public");

      if (!response.ok) {
        throw new Error("Failed to load application settings");
      }

      const settings = await response.json();

      appSettings = {
        ...DEFAULT_SETTINGS,
        ...settings,
      };

      applySettings();
    } catch (error) {
      console.error("Failed to load application settings:", error);

      /*
       * Keep the chatbot usable with safe defaults if
       * settings cannot be loaded.
       */
      appSettings = {
        ...DEFAULT_SETTINGS,
      };

      applySettings();
    }
  }

  function applySettings() {
    const name =
      String(appSettings.application_name || "ChatBot").trim() || "ChatBot";

    const maxLength = Number(appSettings.max_message_length);

    appSettings.max_message_length =
      Number.isInteger(maxLength) && maxLength > 0
        ? maxLength
        : DEFAULT_SETTINGS.max_message_length;

    /* Application name */

    if (applicationName) {
      applicationName.textContent = name;
    }

    if (pageTitle) {
      pageTitle.textContent = name;
    }

    document.title = name;

    /* Maximum message length */

    if (input) {
      input.maxLength = appSettings.max_message_length;
      input.placeholder = `Type your message...`;
    }

    updateMessageCounter();

    /* Maintenance mode */

    if (appSettings.maintenance_mode === true) {
      enableMaintenanceMode();
    } else {
      disableMaintenanceMode();
    }
  }

  /* ================= MAINTENANCE MODE ================= */

  function enableMaintenanceMode() {
    if (input) {
      input.disabled = true;
      input.placeholder = "Chatbot is currently under maintenance.";
    }

    if (button) {
      button.disabled = true;
    }

    const existingNotice = document.getElementById("maintenanceNotice");

    if (!existingNotice) {
      const notice = document.createElement("div");

      notice.id = "maintenanceNotice";
      notice.className = "bot-message";

      const bubble = document.createElement("div");

      bubble.className = "bubble";
      bubble.textContent =
        "The chatbot is currently under maintenance. Please try again later.";

      notice.appendChild(bubble);

      chatBody.appendChild(notice);
    }
  }

  function disableMaintenanceMode() {
    if (input) {
      input.disabled = false;
      input.placeholder = "Type your message...";
    }

    if (button) {
      button.disabled = false;
    }

    const notice = document.getElementById("maintenanceNotice");

    if (notice) {
      notice.remove();
    }
  }

  /* ================= MESSAGE COUNTER ================= */

  function updateMessageCounter() {
    if (!messageCounter || !input) {
      return;
    }

    const currentLength = input.value.length;
    const maxLength = appSettings.max_message_length;

    messageCounter.textContent = `${currentLength} / ${maxLength}`;

    if (currentLength >= maxLength) {
      messageCounter.classList.add("limit-reached");
    } else {
      messageCounter.classList.remove("limit-reached");
    }
  }

  /* ================= EVENTS ================= */

  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  if (filesBtn) {
    filesBtn.addEventListener("click", () => {
      window.location.href = "files.html";
    });
  }

  if (button) {
    button.addEventListener("click", sendMessage);
  }

  if (input) {
    input.addEventListener("input", updateMessageCounter);

    input.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
      }
    });
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
    if (appSettings.maintenance_mode === true) {
      appendBot(
        "The chatbot is currently under maintenance. Please try again later.",
      );
      return;
    }

    const message = input.value.trim();

    if (message === "") {
      return;
    }

    const maxLength = appSettings.max_message_length;

    if (message.length > maxLength) {
      appendBot(
        `Your message is too long. Please keep it within ${maxLength} characters.`,
      );

      return;
    }

    appendUser(message);

    input.value = "";

    updateMessageCounter();

    showTyping();

    try {
      const response = await fetch("/rasa/webhooks/rest/webhook", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("authToken"),
        },

        body: JSON.stringify({
          sender: localStorage.getItem("username"),

          message: message,

          metadata: {
            Authorization: "Bearer " + localStorage.getItem("authToken"),
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Bot API failed");
      }

      const data = await response.json();

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

              Authorization: "Bearer " + localStorage.getItem("authToken"),
            },

            body: JSON.stringify({
              session_id: localStorage.getItem("username"),

              sender: "user",

              message: message,

              response: msg.text,
            }),
          });
        }
      } else {
        appendBot("No response from bot.");
      }
    } catch (error) {
      console.error("Chat error:", error);

      hideTyping();

      appendBot("Unable to connect to server.");
    }
  }

  /* ================= USER MESSAGE ================= */

  function appendUser(message) {
    const wrapper = document.createElement("div");

    wrapper.className = "user-message";

    const bubble = document.createElement("div");

    bubble.className = "bubble";

    /*
     * textContent is intentionally used instead of innerHTML
     * so user input cannot inject HTML/JavaScript.
     */

    const messageText = document.createElement("div");

    messageText.textContent = message;

    const timestamp = document.createElement("div");

    timestamp.className = "timestamp";
    timestamp.textContent = getTime();

    bubble.appendChild(messageText);
    bubble.appendChild(timestamp);

    wrapper.appendChild(bubble);

    chatBody.appendChild(wrapper);

    scrollBottom();
  }

  /* ================= BOT MESSAGE ================= */

  function appendBot(message) {
    const wrapper = document.createElement("div");

    wrapper.className = "bot-message";

    const bubble = document.createElement("div");

    bubble.className = "bubble";

    wrapper.appendChild(bubble);

    chatBody.appendChild(wrapper);

    scrollBottom();

    simulateTyping(bubble, message);
  }

  /* ================= TYPING ANIMATION ================= */

  async function simulateTyping(element, message) {
    element.textContent = "";

    const words = String(message).split(" ");

    for (let i = 0; i < words.length; i++) {
      element.textContent += words[i] + (i < words.length - 1 ? " " : "");

      scrollBottom();

      await new Promise((resolve) =>
        setTimeout(resolve, 120 + Math.random() * 80),
      );
    }

    const timestamp = document.createElement("div");

    timestamp.className = "timestamp";
    timestamp.textContent = getTime();

    element.appendChild(timestamp);
  }

  /* ================= SCROLL ================= */

  function scrollBottom() {
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  /* ================= TIME ================= */

  function getTime() {
    const now = new Date();

    let hours = now.getHours();
    let minutes = now.getMinutes();

    minutes = minutes < 10 ? "0" + minutes : minutes;

    return `${hours}:${minutes}`;
  }

  /* ================= INITIALIZE ================= */

  await loadSettings();
});

/* ================= LOGOUT ================= */

function logout() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("username");
  localStorage.removeItem("role");

  window.location.href = "login.html";
}
