(function defineXZenSettings(global) {
  "use strict";

  const defaults = Object.freeze({
    feedWidth: 720,
    hideRightRail: true
  });

  function normalizeFeedWidth(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return defaults.feedWidth;
    }

    const clamped = Math.min(900, Math.max(560, value));
    return Math.round(clamped / 20) * 20;
  }

  function sanitize(value) {
    return {
      feedWidth: normalizeFeedWidth(value?.feedWidth),
      hideRightRail:
        typeof value?.hideRightRail === "boolean"
          ? value.hideRightRail
          : defaults.hideRightRail
    };
  }

  global.X_ZEN = Object.freeze({
    defaults,
    sanitize,
    storageKey: "settings"
  });
})(globalThis);
