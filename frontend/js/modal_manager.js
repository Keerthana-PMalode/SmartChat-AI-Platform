// modal_manager.js

class ModalManager {
  constructor() {
    this.activeModal = null;
    this.previousFocus = null;
    this.cleanup = null;
  }

  confirm({
    modalId,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
  }) {
    return new Promise((resolve) => {
      const modal = document.getElementById(modalId);
      console.log("modal =", modal);
      console.log("modal HTML =", modal.outerHTML);

      if (!modal) {
        throw new Error(`Modal with id "${modalId}" was not found.`);
      }
      console.log("modal =", modal);

      const titleEl = modal.querySelector("[data-modal-title]");
      const messageEl = modal.querySelector("[data-modal-message]");

      const confirmBtn = modal.querySelector("[data-modal-confirm]");
      const cancelBtn = modal.querySelector("[data-modal-cancel]");

      titleEl.textContent = title;
      messageEl.textContent = message;

      confirmBtn.textContent = confirmText;
      cancelBtn.textContent = cancelText;

      const close = (value) => {
        confirmBtn.removeEventListener("click", onConfirm);
        cancelBtn.removeEventListener("click", onCancel);

        document.removeEventListener("keydown", keyboardHandler);

        this.close();

        resolve(value);
      };

      const onConfirm = () => close(true);

      const onCancel = () => close(false);

      confirmBtn.addEventListener("click", onConfirm);

      cancelBtn.addEventListener("click", onCancel);

      const keyboardHandler = (e) => {
        switch (e.key) {
          case "Escape":
            e.preventDefault();
            close(false);
            break;

          case "Enter":
            if (document.activeElement === confirmBtn) {
              e.preventDefault();
              close(true);
            } else if (document.activeElement === cancelBtn) {
              e.preventDefault();
              close(false);
            }

            break;
        }
      };

      document.addEventListener("keydown", keyboardHandler);

      this.open(modal);
    });
  }

  open(modal) {
    this.previousFocus = document.activeElement;

    this.activeModal = modal;

    document.querySelector("main")?.setAttribute("inert", "");

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

    const focusable = modal.querySelectorAll(
      "button,[href],input,select,textarea,[tabindex]:not([tabindex='-1'])",
    );

    if (focusable.length) focusable[0].focus();

    this.cleanup = this.installKeyboardSupport(focusable);
  }

  close() {
    if (!this.activeModal) return;

    document.querySelector("main")?.removeAttribute("inert");

    this.activeModal.classList.add("hidden");
    this.activeModal.setAttribute("aria-hidden", "true");

    this.cleanup?.();

    this.previousFocus?.focus();

    this.activeModal = null;
  }

  installKeyboardSupport(focusable) {
    const handler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();

        this.close(); // use a callback passed into installKeyboardSupport()

        return;
      }

      if (e.key !== "Tab") return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handler);

    return () => document.removeEventListener("keydown", handler);
  }
}

export const modalManager = new ModalManager();
