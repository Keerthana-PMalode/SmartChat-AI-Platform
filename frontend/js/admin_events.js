// admin_events.js

class EventBusClass {
  constructor() {
    this.events = {};
  }

  /**
   * Subscribe to an event
   */
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }

    this.events[event].push(callback);
  }

  /**
   * Emit event with data
   * Always wraps payload as { detail }
   */
  emit(event, data = {}) {
    const handlers = this.events[event];

    if (!handlers || handlers.length === 0) return;

    handlers.forEach((callback) => {
      try {
        callback({ detail: data });
      } catch (err) {
        console.error(`[EventBus error] ${event}`, err);
      }
    });
  }

  /**
   * Optional: remove listener (useful later)
   */
  off(event, callback) {
    if (!this.events[event]) return;

    this.events[event] = this.events[event].filter((cb) => cb !== callback);
  }

  /**
   * Optional: clear all events
   */
  clear() {
    this.events = {};
  }
}

// ✅ IMPORTANT: named export (this fixes your error)
export const EventBus = new EventBusClass();
