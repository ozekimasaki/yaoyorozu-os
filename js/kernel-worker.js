let interval = 1000;

function tick() {
  self.postMessage({ type: "tick", t: Date.now() });
}

let timer = setInterval(tick, interval);

self.onmessage = (ev) => {
  const msg = ev.data || {};
  if (msg.type === "interval" && msg.ms) {
    interval = Math.max(400, Number(msg.ms) || 1000);
    clearInterval(timer);
    timer = setInterval(tick, interval);
  }
  if (msg.type === "stop") {
    clearInterval(timer);
    timer = 0;
  }
  if (msg.type === "start") {
    if (!timer) timer = setInterval(tick, interval);
  }
};
