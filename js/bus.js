const CHANNEL = "yaoyorozu-bus";

export const tabId = `tab-${Math.random().toString(16).slice(2, 10)}`;

export function createBus(onRemote) {
  let channel = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
  } catch (err) {
    return {
      post() {},
      close() {},
      tabId,
    };
  }
  channel.onmessage = (ev) => {
    const msg = ev.data;
    if (!msg || msg.origin === tabId) return;
    onRemote(msg);
  };
  return {
    tabId,
    post(msg) {
      try {
        channel.postMessage({ ...msg, origin: tabId, at: Date.now() });
      } catch (err) {
        /* 片側の器が閉じている */
      }
    },
    close() {
      try {
        channel.close();
      } catch (err) {
        /* already closed */
      }
    },
  };
}
