(function startOffscreenAudio() {
  "use strict";

  // Offscreen documents may not expose the storage APIs, so playback decisions
  // are made by the background worker: it sends PLAY only when the hourly
  // bell is enabled and STOP whenever it is switched off.
  const PLAY_MESSAGE = "x-zen-play-hourly-bell";
  const STOP_MESSAGE = "x-zen-stop-hourly-bell";
  const audio = new Audio(chrome.runtime.getURL("assets/audio/hourly-bell.mp3"));
  audio.preload = "auto";
  let playbackToken = 0;

  function stopAudio() {
    audio.pause();
    audio.currentTime = 0;
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === PLAY_MESSAGE) {
      const requestedToken = ++playbackToken;
      stopAudio();
      void audio.play().catch((error) => {
        if (requestedToken !== playbackToken) return;
        console.error("x-zen could not play the hourly bell", error);
      });
    } else if (message?.type === STOP_MESSAGE) {
      playbackToken += 1;
      stopAudio();
    }
  });
})();
