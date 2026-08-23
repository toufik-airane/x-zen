import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const listeners = { message: [] };
const calls = { pause: 0, play: 0 };
let failNextPlay = false;

class AudioMock {
  constructor() {
    this.currentTime = 9;
    this.preload = "";
  }

  pause() {
    calls.pause += 1;
  }

  async play() {
    if (failNextPlay) {
      failNextPlay = false;
      throw new Error("playback blocked");
    }
    calls.play += 1;
  }
}

const chrome = {
  runtime: {
    getURL(path) {
      return `chrome-extension://test/${path}`;
    },
    onMessage: {
      addListener(listener) {
        listeners.message.push(listener);
      }
    }
  }
};
const source = await readFile(new URL("../offscreen.js", import.meta.url), "utf8");
vm.runInContext(source, vm.createContext({ Audio: AudioMock, chrome, console }));

function flushTasks() {
  return new Promise((resolve) => setImmediate(resolve));
}

listeners.message[0]({ type: "x-zen-play-hourly-bell" });
await flushTasks();
assert.equal(calls.play, 1, "a play message must start playback");

listeners.message[0]({ type: "x-zen-stop-hourly-bell" });
assert.equal(calls.pause >= 1, true, "a stop message must pause audio");
assert.equal(vm.runInContext("audio.currentTime", vm.createContext({ audio: { currentTime: 0 } })), 0);

const pausesBeforeRestart = calls.pause;
listeners.message[0]({ type: "x-zen-play-hourly-bell" });
listeners.message[0]({ type: "x-zen-stop-hourly-bell" });
await flushTasks();
assert.ok(
  calls.pause >= pausesBeforeRestart + 1,
  "a stop racing a play must silence it"
);

failNextPlay = true;
listeners.message[0]({ type: "x-zen-play-hourly-bell" });
await flushTasks();
listeners.message[0]({ type: "x-zen-stop-hourly-bell" });
await flushTasks();
console.log("x-zen offscreen audio tests passed.");
