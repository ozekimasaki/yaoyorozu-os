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

export function openPath(path) {
  kernel.noteRecent(path);
  const file = path;
  if (file.endsWith(".gate")) {
    return kernel.vfs.read(path).then((f) => launch(f.body.trim()));
  }
  if (path.startsWith("/mnt/") && path.includes("/shrines/")) {
    return launch("editor", { path });
  }
  if (path.startsWith("/etc") || path.endsWith(".txt") || path.endsWith(".yaoyorozu") || path.endsWith(".ofuda")) {
    return launch("editor", { path });
  }
  return launch("fs", { path });
}
