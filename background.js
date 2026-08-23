(function startBackground() {
  "use strict";

  const ENABLED_KEY = "hourlyBellEnabled";
  const ALARM_NAME = "x-zen-hourly-bell";
  const PLAY_MESSAGE = "x-zen-play-hourly-bell";
  const STOP_MESSAGE = "x-zen-stop-hourly-bell";
  const PREVIEW_MESSAGE = "x-zen-preview-hourly-bell";
  const WAKE_MESSAGE = "x-zen-wake-hourly-bell";
  const OFFSCREEN_DOCUMENT_PATH = "offscreen.html";
  const HOUR_MS = 60 * 60 * 1000;
  let offscreenCreation;

  // The sound toggle lives in session storage so it resets each browser
  // session; expose it to content scripts so x.com can render the button.
  chrome.storage.session.setAccessLevel({
    accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS"
  });

  function getNextHour(timestamp = Date.now()) {
    return (Math.floor(timestamp / HOUR_MS) + 1) * HOUR_MS;
  }

  function runSafely(task, action) {
    void task.catch((error) => {
      console.error(`x-zen could not ${action}`, error);
    });
  }

  async function syncAlarm() {
    const result = await chrome.storage.session.get(ENABLED_KEY);
    await chrome.alarms.clearAll();
    if (result[ENABLED_KEY] === true) {
      await chrome.alarms.create(ALARM_NAME, {
        periodInMinutes: 60,
        when: getNextHour()
      });
    }
  }

  function getOffscreenContexts() {
    return chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH)]
    });
  }

  async function ensureOffscreenDocument() {
    const contexts = await getOffscreenContexts();
    if (contexts.length > 0) return;

    if (!offscreenCreation) {
      offscreenCreation = chrome.offscreen
        .createDocument({
          url: OFFSCREEN_DOCUMENT_PATH,
          reasons: ["AUDIO_PLAYBACK"],
          justification: "Play the user-enabled hourly singing-bowl bell."
        })
        .finally(() => {
          offscreenCreation = undefined;
        });
    }
    await offscreenCreation;
  }

  async function playBell() {
    await ensureOffscreenDocument();
    await chrome.runtime.sendMessage({ type: PLAY_MESSAGE });
  }

  async function playBellIfEnabled() {
    const result = await chrome.storage.session.get(ENABLED_KEY);
    if (result[ENABLED_KEY] === true) await playBell();
  }

  async function stopBell() {
    const contexts = await getOffscreenContexts();
    if (contexts.length > 0) {
      await chrome.runtime.sendMessage({ type: STOP_MESSAGE });
    }
  }

  chrome.runtime.onInstalled.addListener(() => {
    runSafely(syncAlarm(), "schedule the hourly bell");
  });

  chrome.runtime.onStartup.addListener(() => {
    runSafely(syncAlarm(), "restore the hourly bell");
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "session" && changes[ENABLED_KEY]) {
      runSafely(syncAlarm(), "update the hourly bell");
      if (changes[ENABLED_KEY].newValue !== true) {
        runSafely(stopBell(), "stop the hourly bell");
      }
    }
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== ALARM_NAME) return;
    runSafely(playBellIfEnabled(), "play the hourly bell");
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === PREVIEW_MESSAGE) {
      runSafely(playBellIfEnabled(), "play the bell preview");
    } else if (message?.type === WAKE_MESSAGE) {
      // Content scripts call this before reading session storage: expose it,
      // confirm, then let the sender retry.
      return chrome.storage.session
        .setAccessLevel({ accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" })
        .then(() => true);
    }
  });

  runSafely(syncAlarm(), "initialize the hourly bell");
})();
