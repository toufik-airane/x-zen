(function startHourlyBellToggle() {
  "use strict";

  const BUTTON_ID = "x-zen-sound";
  const ENABLED_KEY = "hourlyBellEnabled";
  const PREVIEW_MESSAGE = "x-zen-preview-hourly-bell";
  const WAKE_MESSAGE = "x-zen-wake-hourly-bell";
  let enabled = false;

  function render(button) {
    button.dataset.enabled = String(enabled);
    button.setAttribute("aria-pressed", String(enabled));
    button.setAttribute(
      "aria-label",
      enabled ? "Disable hourly bell" : "Enable hourly bell"
    );
    button.title = enabled
      ? "Hourly bell on — select to disable"
      : "Hourly bell off — select to enable and preview";
  }

  async function toggle(button) {
    enabled = !enabled;
    render(button);
    await chrome.storage.session
      .set({ [ENABLED_KEY]: enabled })
      .catch((error) => {
        console.error("x-zen could not save the bell setting", error);
      });
    if (enabled) {
      try {
        await chrome.runtime.sendMessage({ type: PREVIEW_MESSAGE });
      } catch (error) {
        console.error("x-zen could not play the bell preview", error);
      }
    }
  }

  function ensureButton() {
    if (!document.body) return null;

    let button = document.querySelector(`#${BUTTON_ID}`);
    if (button) return button;

    button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 4V5L7 9H3Z"/>
        <path class="x-zen-sound-waves" d="M15.2 8.4a1 1 0 0 1 1.4 0 5.1 5.1 0 0 1 0 7.2 1 1 0 1 1-1.4-1.4 3.1 3.1 0 0 0 0-4.4 1 1 0 0 1 0-1.4Zm3-3a1 1 0 0 1 1.4 0 9.3 9.3 0 0 1 0 13.2 1 1 0 1 1-1.4-1.4 7.3 7.3 0 0 0 0-10.4 1 1 0 0 1 0-1.4Z"/>
        <path class="x-zen-sound-slash" d="m4 4 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2"/>
      </svg>
    `;
    button.addEventListener("click", () => {
      void toggle(button);
    });
    document.body.append(button);
    render(button);
    return button;
  }

  // The toggle lives in session storage so it resets once per browser
  // session. Session storage is hidden from content scripts until the
  // background worker has exposed it, so wake the worker and retry once.
  async function readEnabled() {
    try {
      const result = await chrome.storage.session.get(ENABLED_KEY);
      return result[ENABLED_KEY] === true;
    } catch {
      try {
        await chrome.runtime.sendMessage({ type: WAKE_MESSAGE });
      } catch {}
      try {
        const result = await chrome.storage.session.get(ENABLED_KEY);
        return result[ENABLED_KEY] === true;
      } catch {
        return false;
      }
    }
  }

  void readEnabled().then((stored) => {
    enabled = stored;
    const button = ensureButton();
    if (button) render(button);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "session" || !changes[ENABLED_KEY]) return;
    enabled = changes[ENABLED_KEY].newValue === true;
    const button = ensureButton();
    if (button) render(button);
  });

  if (!ensureButton()) {
    const bootObserver = new MutationObserver(() => {
      if (ensureButton()) bootObserver.disconnect();
    });
    bootObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
