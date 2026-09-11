import { kernel } from "./kernel.js";
import { createWm } from "./wm.js";

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
  });
  kernel.log(`exec ${app.id} pid=${proc.pid}`, "runtime");
  return win;
}

export async function openPath(path) {
  try {
    const f = await kernel.readPath(path);
    kernel.noteRecent(f.path || path);
    if (f.mime === "gate/app" || (f.path || path).endsWith(".gate")) {
      return launch(String(f.body || "").trim());
    }
    if (f.mime === "text/proc" || (f.path || path).startsWith("/proc/")) {
      return launch("editor", { path: f.path || path });
    }
    if ((f.path || path).startsWith("/mnt/") && (f.path || path).includes("/shrines/")) {
      return launch("editor", { path: f.path || path });
    }
    if (
      (f.path || path).startsWith("/etc") ||
      (f.path || path).endsWith(".txt") ||
      (f.path || path).endsWith(".yaoyorozu") ||
      (f.path || path).endsWith(".ofuda")
    ) {
      return launch("editor", { path: f.path || path });
    }
    return launch("fs", { path: f.path || path });
  } catch (err) {
    kernel.log(`open ${path}: ${err.message}`, "fs");
    return launch("fs", { path });
  }
}
