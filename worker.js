const rooms = new Map();

function slug(raw) {
  const s = String(raw || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._:-]/g, "")
    .slice(0, 32);
  return s;
}

function handleWatari(request) {
  const url = new URL(request.url);
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("watari\n", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  const kotoba = slug(url.searchParams.get("k") || "");
  if (!kotoba) return new Response("EINVAL", { status: 400 });
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  if (!rooms.has(kotoba)) rooms.set(kotoba, new Set());
  const set = rooms.get(kotoba);
  if (set.size >= 2) {
    try {
      server.close(1013, "EBUSY");
    } catch (err) {
      /* full */
    }
    return new Response(null, { status: 101, webSocket: client });
  }
  set.add(server);
  server.addEventListener("message", (ev) => {
    for (const ws of set) {
      if (ws === server) continue;
      try {
        ws.send(ev.data);
      } catch (err) {
        /* drop */
      }
    }
  });
  const leave = () => {
    set.delete(server);
    if (!set.size) rooms.delete(kotoba);
  };
  server.addEventListener("close", leave);
  server.addEventListener("error", leave);
  return new Response(null, { status: 101, webSocket: client });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/watari") return handleWatari(request);
    if (env && env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("ENOENT", { status: 404 });
  },
};
