import { kernel } from "./kernel.js";
import { createWm } from "./wm.js";
import { handlersFor, resolveOpen } from "./intent.js";

const registry = new Map();
let wm = null;

export function register(app) {
  registry.set(app.id, app);
}

export function apps() {
  return [...registry.values()];
}

export function getApp(id) {
  return registry.get(id);
}

export function bindWm(root, taskbar) {
  wm = createWm(root, taskbar, kernel);
  return wm;
}

export function getWm() {
  return wm;
}

export function launch(appId, opts = {}) {
  const app = registry.get(appId);
  if (!app) {
    kernel.log(`app not found: ${appId}`, "runtime");
    return null;
  }
  const proc = kernel.spawnApp(appId, app.title);
  const view = app.spawn({
    kernel,
    wm,
    pid: proc.pid,
    launch,
    ...opts,
  });
  const win = wm.create({
    appId,
    title: view.title || app.title,
    pid: proc.pid,
    space: opts.space || kernel.state.currentSpace,
    width: view.width || app.width,
    height: view.height || app.height,
    geom: opts.geom,
    mount: view.el,
    onClose: view.onClose,
    onFocus: view.onFocus,
    onPause: view.onPause,
    onResume: view.onResume,
    onDrop: view.onDrop,
  });
  kernel.log(`exec ${app.id} pid=${proc.pid}`, "runtime");
  return win;
}

export async function listHandlers(path) {
  let file = { path, type: "file" };
  try {
    file = await kernel.readPath(path);
  } catch (err) {
    file = { path, type: "file" };
  }
  const ids = new Set(apps().map((a) => a.id));
  return handlersFor(file.path || path, file, await kernel.assocTable(), ids);
}

export async function openPath(path, opts = {}) {
  const withId = opts.with;
  try {
    const f = await kernel.readPath(path);
    const dest = f.path || path;
    kernel.noteRecent(dest);
    if (withId && withId !== "gate") return launch(withId, { path: dest });
    const table = await kernel.assocTable();
    const hit = withId === "gate" ? { app: "gate" } : resolveOpen(dest, f, table);
    if (hit.app === "gate") return launch(String(f.body || "").trim());
    if (hit.app === "fs") return launch("fs", { path: dest });
    return launch(hit.app, { path: dest });
  } catch (err) {
    kernel.log(`open ${path}: ${err.message}`, "fs");
    if (withId && withId !== "gate") return launch(withId, { path });
    return launch("fs", { path });
  }
}
