import { kernel } from "./kernel.js";
import { register, bindWm, launch, openPath, getWm } from "./runtime.js";
import oncall from "./apps/oncall.js";
import map from "./apps/map.js";
import proc from "./apps/proc.js";
import fs from "./apps/fs.js";
import editor from "./apps/editor.js";
import fw from "./apps/fw.js";
import net from "./apps/net.js";
import dmesg from "./apps/dmesg.js";
import term from "./apps/term.js";
import sim from "./apps/sim.js";
import ma from "./apps/ma.js";
import cal from "./apps/cal.js";
import clip from "./apps/clip.js";
import sys from "./apps/sys.js";
import muen from "./apps/muen.js";
import oto from "./apps/oto.js";
import { bindTorii } from "./apps/torii.js";
import { bindKashiwa } from "./kashiwa.js";
import { startField } from "./field.js";
import { startIrq } from "./irq.js";
import { peekPath as peekPathIo, showFileStat as showStatIo, copyPathNow as copyPathIo, closeEl } from "./desk-io.js";
import { bindSwitchers } from "./switchers.js";
import { bindPhone, isPhone } from "./phone.js";
import { bindSheet, openWithSheet, openShareSheet, closeSheet } from "./sheet.js";
import { guessIcon, labelWithIcon } from "./icons.js";

register(oncall);
register(map);
register(proc);
register(fs);
register(editor);
register(fw);
register(net);
register(dmesg);
register(term);
register(sim);
register(ma);
register(cal);
register(clip);
register(sys);
register(muen);
register(oto);

function landColor(cpu) {
  if (cpu >= 85) return "#4f7d61";
  if (cpu >= 70) return "#3d5c4a";
  if (cpu >= 50) return "#8a7328";
  if (cpu >= 35) return "#8a4a1c";
  return "#7a241c";
}

function applyJob(job) {
  if (!job) return;
  if (job.prefId) {
    kernel.emit("spotlight", job.prefId);
  }
  if (job.kind === "attach" || job.kind === "route" || job.kind === "migrate") launch("map");
  if (job.kind === "hold" && job.article) openPath("/etc/ofuda/constitution.20");
}

let lastDeskSig = "";
let lastDeskPick = "";
let deskPos = null;
let deskSelected = new Set();
let deskClipboard = { mode: "copy", paths: [] };
let muenUndo = [];
let deskTypeQ = "";
let deskTypeT = 0;
let marquee = null;

function endMarquee() {
  if (!marquee) return;
  marquee = null;
  const band = document.getElementById("desk-marquee");
  if (band) band.hidden = true;
}

async function loadDeskPos() {
  if (deskPos) return deskPos;
  try {
    deskPos = (await kernel.vfs.metaGet("deskPos")) || {};
  } catch (err) {
    deskPos = {};
  }
  return deskPos;
}

function saveDeskPos() {
  if (!deskPos) return;
  kernel.vfs.metaSet("deskPos", deskPos);
}

async function paintDesktop() {
  const desk = document.getElementById("desktop");
  const pref = kernel.spacePref();
  desk.style.setProperty("--space-land", landColor(pref.unusedCpu));
  const spaceText = `kernel: ${pref.name}`;
  const kamiText = `kami: ${kernel.state.processes.filter((p) => p.kind !== "app").length}`;
  const spaceEl = document.getElementById("space-pill");
  const kamiEl = document.getElementById("kami-pill");
  if (spaceEl.textContent !== spaceText) spaceEl.textContent = spaceText;
  if (kamiEl.textContent !== kamiText) kamiEl.textContent = kamiText;
  const icons = document.getElementById("desktop-icons");
  let rows = [];
  try {
    rows = await kernel.vfs.ls(`/home/${kernel.state.ujiko}/desktop`);
  } catch (err) {
    rows = [];
  }
  const sig = rows.map((f) => f.path).join("\n");
  if (sig === lastDeskSig && icons.children.length) {
    paintDeskMarks();
    return;
  }
  lastDeskSig = sig;
  const pos = await loadDeskPos();
  icons.innerHTML = "";
  rows.forEach((f, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "desk-icon";
    btn.dataset.path = f.path;
    const iconId = guessIcon(f);
    btn.dataset.icon = iconId;
    labelWithIcon(btn, iconId, f.name.replace(".gate", ""));
    const saved = pos[f.path];
    const left = saved ? saved.x : 18;
    const top = saved ? saved.y : 58 + i * 52;
    btn.style.left = `${left}px`;
    btn.style.top = `${top}px`;
    let dragging = false;
    let moved = false;
    let ox = 0;
    let oy = 0;
    let sx = left;
    let sy = top;
    let group = [];
    btn.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      icons.style.zIndex = "20";
      sx = btn.offsetLeft;
      sy = btn.offsetTop;
      ox = e.clientX - sx;
      oy = e.clientY - sy;
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !deskSelected.has(f.path)) {
        deskSelected = new Set([f.path]);
        lastDeskPick = f.path;
        paintDeskMarks();
      }
      const paths = deskSelected.has(f.path) ? [...deskSelected] : [f.path];
      group = paths
        .map((path) => {
          const el = [...icons.querySelectorAll(".desk-icon")].find((n) => n.dataset.path === path);
          return el ? { el, path, x: el.offsetLeft, y: el.offsetTop } : null;
        })
        .filter(Boolean);
      const move = (ev) => {
        if (!dragging) return;
        const x = Math.max(8, ev.clientX - ox);
        const y = Math.max(48, ev.clientY - oy);
        const dx = x - sx;
        const dy = y - sy;
        if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        for (const g of group) {
          g.el.style.left = `${Math.max(8, g.x + dx)}px`;
          g.el.style.top = `${Math.max(48, g.y + dy)}px`;
        }
        clearDropMarks();
        if (moved) {
          const win = windowAt(ev.clientX, ev.clientY);
          if (win) win.classList.add("is-drop");
        }
      };
      const up = (ev) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        dragging = false;
        icons.style.zIndex = "";
        lastDeskPick = f.path;
        const win = moved ? windowAt(ev.clientX, ev.clientY) : null;
        clearDropMarks();
        if (moved && win) {
          for (const g of group) {
            g.el.style.left = `${g.x}px`;
            g.el.style.top = `${g.y}px`;
          }
          dropOnWindow(
            win,
            group.map((g) => g.path)
          );
          return;
        }
        if (moved) {
          for (const g of group) {
            const snapped = snapDesk(g.el.offsetLeft, g.el.offsetTop);
            g.el.style.left = `${snapped.x}px`;
            g.el.style.top = `${snapped.y}px`;
            pos[g.path] = snapped;
          }
          deskPos = pos;
          saveDeskPos();
          return;
        }
        if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
          if (deskSelected.has(f.path)) deskSelected.delete(f.path);
          else deskSelected.add(f.path);
          paintDeskMarks();
          return;
        }
        deskSelected = new Set([f.path]);
        paintDeskMarks();
        openPath(f.path);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
    icons.appendChild(btn);
  });
  paintDeskMarks();
}

function paintDeskMarks() {
  const cut = deskClipboard.mode === "cut" ? new Set(deskClipboard.paths) : null;
  document.querySelectorAll(".desk-icon").forEach((el) => {
    const p = el.dataset.path;
    el.classList.toggle("is-on", deskSelected.has(p) || p === lastDeskPick);
    el.classList.toggle("is-cut", !!(cut && cut.has(p)));
  });
}

function selectedDeskPaths() {
  if (deskSelected.size) return [...deskSelected];
  if (lastDeskPick) return [lastDeskPick];
  return [];
}

function snapDesk(x, y) {
  const gx = 120;
  const gy = 64;
  const col = Math.max(0, Math.round((x - 18) / gx));
  const row = Math.max(0, Math.round((y - 58) / gy));
  return { x: 18 + col * gx, y: 58 + row * gy };
}

function uniqueDeskName(name, taken) {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let i = 2;
  while (taken.has(`${stem}-${i}${ext}`)) i += 1;
  return `${stem}-${i}${ext}`;
}

async function copyTree(from, to) {
  return kernel.vfs.copyTree(from, to);
}

function windowAt(x, y) {
  const icons = document.getElementById("desktop-icons");
  const prev = icons ? icons.style.pointerEvents : "";
  if (icons) icons.style.pointerEvents = "none";
  const stack = document.elementsFromPoint(x, y);
  if (icons) icons.style.pointerEvents = prev;
  for (const n of stack) {
    if (n.id === "desk-marquee") continue;
    const win = n.closest && n.closest(".window");
    if (win && !win.classList.contains("is-away") && !win.classList.contains("is-min")) return win;
  }
  return null;
}

function clearDropMarks() {
  document.querySelectorAll(".window.is-drop").forEach((n) => n.classList.remove("is-drop"));
}

async function dropOnWindow(winEl, paths) {
  const wm = getWm();
  const w = wm ? wm.list().find((x) => x.el === winEl) : null;
  if (!w || !paths.length) return;
  if (typeof w.onDrop === "function") {
    await w.onDrop(paths);
    wm.focus(w.pid);
    kernel.log(`\u672d\u3092${w.title}\u3078\u843d\u3068\u3057\u305f`, "desk");
    return;
  }
  openPath(paths[0]);
}

async function duplicateDesk() {
  const paths = selectedDeskPaths();
  if (!paths.length) return;
  deskClipboard = { mode: "copy", paths };
  await pasteDesk();
}

function copyDesk(cut) {
  const paths = selectedDeskPaths();
  if (!paths.length) return;
  deskClipboard = kernel.clipVfs(cut ? "cut" : "copy", paths);
  paintDeskMarks();
  kernel.log(cut ? "\u5353\u3092\u5207\u3063\u305f" : "\u5353\u3092\u5199\u3057\u305f", "desk");
}

async function pasteDesk() {
  const clip = kernel.state.vfsClip || deskClipboard;
  if (!clip.paths.length) return;
  deskClipboard = clip;
  const desk = `/home/${kernel.state.ujiko}/desktop`;
  let rows = [];
  try {
    rows = await kernel.vfs.ls(desk);
  } catch (err) {
    rows = [];
  }
  const taken = new Set(rows.map((r) => r.name));
  let n = 0;
  for (const src of deskClipboard.paths) {
    const name = uniqueDeskName(kernel.vfs.nameOf(src), taken);
    taken.add(name);
    const dest = kernel.vfs.normalize(`${desk}/${name}`);
    try {
      if (deskClipboard.mode === "cut") {
        try {
          await kernel.vfs.rename(src, dest);
        } catch (err) {
          if (err.message === "EXDEV" || err.message === "EISDIR") {
            kernel.log("\u5323\u306e\u5207\u308a\u306f\u5199\u3057\u3066\u6b8b\u3059", "desk");
            await copyTree(src, dest);
          } else {
            await copyTree(src, dest);
            await kernel.vfs.moveToMuen(src);
          }
        }
      } else {
        await copyTree(src, dest);
      }
      n += 1;
    } catch (err) {
      kernel.log(`\u8cbc\u308b: ${err.message}`, "desk");
    }
  }
  if (deskClipboard.mode === "cut") {
    deskClipboard = { mode: "copy", paths: [] };
    kernel.clipVfs("copy", []);
  }
  deskSelected.clear();
  kernel.emit("vfs");
  kernel.log(`\u5353\u306b\u8cbc\u3063\u305f \u00d7${n}`, "desk");
}

function selectAllDesk() {
  document.querySelectorAll(".desk-icon").forEach((el) => {
    if (el.dataset.path) deskSelected.add(el.dataset.path);
  });
  paintDeskMarks();
}

function tidyDesk() {
  const icons = [...document.querySelectorAll(".desk-icon")].sort((a, b) => {
    const dy = a.offsetTop - b.offsetTop;
    if (Math.abs(dy) > 24) return dy;
    return a.offsetLeft - b.offsetLeft;
  });
  const pos = deskPos || {};
  icons.forEach((el, i) => {
    const col = i % 8;
    const row = (i / 8) | 0;
    const x = 18 + col * 120;
    const y = 58 + row * 64;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    pos[el.dataset.path] = { x, y };
  });
  deskPos = pos;
  saveDeskPos();
  kernel.log("\u672d\u3092\u63c3\u3048\u305f", "desk");
}

async function sendToMuen(paths) {
  for (const p of paths) {
    try {
      const dest = await kernel.vfs.moveToMuen(p);
      muenUndo.push({ dest, origin: p });
    } catch (err) {
      kernel.log(`muen: ${err.message}`, "fs");
    }
  }
  muenUndo = muenUndo.slice(-16);
  deskSelected.clear();
  lastDeskPick = "";
  kernel.emit("vfs");
}

async function muenSelected() {
  await sendToMuen(selectedDeskPaths());
}

async function undoMuen() {
  const rec = muenUndo.pop();
  if (!rec) {
    kernel.log("\u623b\u3059\u672d\u306f\u306a\u3044", "desk");
    return;
  }
  try {
    const to = await kernel.vfs.restoreFromMuen(rec.dest, rec.origin);
    lastDeskPick = to;
    deskSelected = new Set([to]);
    kernel.noteRecent(to);
    kernel.emit("vfs");
    kernel.log(`\u7121\u7e01\u304b\u3089\u623b\u3057\u305f ${to}`, "desk");
  } catch (err) {
    kernel.log(`\u623b\u3059: ${err.message}`, "desk");
  }
}

async function newDeskOfuda() {
  const path = `/home/${kernel.state.ujiko}/desktop/${Date.now()}.ofuda`;
  await kernel.vfs.write(path, "\u540d\u3092\u66f8\u3051\u3002\u7a7a\u306e\u30b9\u30ed\u30fc\u30ac\u30f3\u306f\u30b3\u30f3\u30d1\u30a4\u30eb\u3055\u308c\u306a\u3044\u3002", "text/plain");
  lastDeskPick = path;
  kernel.emit("vfs");
  launch("editor", { path });
}

async function newDeskBox() {
  const path = `/home/${kernel.state.ujiko}/desktop/\u5323-${Date.now()}`;
  await kernel.vfs.mkdir(path);
  lastDeskPick = path;
  kernel.emit("vfs");
}

function typeDeskJump(ch) {
  clearTimeout(deskTypeT);
  deskTypeQ += ch;
  deskTypeT = setTimeout(() => {
    deskTypeQ = "";
  }, 900);
  const q = deskTypeQ.toLowerCase();
  const icons = [...document.querySelectorAll(".desk-icon")];
  const hit = icons.find((el) => {
    const label = (el.textContent || "").toLowerCase();
    const name = kernel.vfs.nameOf(el.dataset.path || "").toLowerCase();
    return label.startsWith(q) || name.startsWith(q);
  });
  if (!hit) return;
  lastDeskPick = hit.dataset.path || "";
  deskSelected = new Set(lastDeskPick ? [lastDeskPick] : []);
  paintDeskMarks();
  hit.focus();
}

function peekPath(path) {
  return peekPathIo(kernel, path);
}

async function peekDesk() {
  await peekPath(lastDeskPick || selectedDeskPaths()[0]);
}

function closeDeskPeek() {
  closeEl("desk-peek");
}

function showFileStat(path) {
  return showStatIo(kernel, path);
}

function closeFileStat() {
  closeEl("file-stat");
}

function closeRecent() {
  const box = document.getElementById("recent-list");
  if (box) box.hidden = true;
}

function copyPathNow(path) {
  copyPathIo(kernel, path || lastDeskPick || selectedDeskPaths()[0]);
}

function openPickedBox() {
  const path = lastDeskPick || selectedDeskPaths()[0];
  const dest = path ? kernel.vfs.parentOf(path) : `/home/${kernel.state.ujiko}/desktop`;
  launch("fs", { path: dest || "/" });
}

async function renamePicked() {
  const path = lastDeskPick || selectedDeskPaths()[0];
  if (!path) return;
  const cur = kernel.vfs.nameOf(path);
  const name = window.prompt("\u65b0\u3057\u3044\u540d", cur);
  if (!name || name === cur) return;
  const dest = kernel.vfs.normalize(`${kernel.vfs.parentOf(path)}/${name}`);
  try {
    await kernel.vfs.rename(path, dest);
    lastDeskPick = dest;
    deskSelected = new Set([dest]);
    kernel.noteRecent(dest);
    kernel.emit("vfs");
  } catch (err) {
    kernel.log(`rename: ${err.message}`, "fs");
  }
}

function focusedWin() {
  const wm = getWm();
  if (!wm) return null;
  return (
    wm.list().find((w) => w.el.classList.contains("focused") && !w.minimized && !w.el.classList.contains("is-away")) ||
    null
  );
}

async function maybeOpenInitGates() {
  if (sessionStorage.getItem("y8-init-opened")) return;
  const wm = getWm();
  if (wm && wm.list().length) return;
  let rows = [];
  try {
    rows = await kernel.vfs.ls(`/home/${kernel.state.ujiko}/.init`);
  } catch (err) {
    return;
  }
  const gates = rows.filter((e) => (e.name || "").endsWith(".gate")).slice(0, 4);
  if (!gates.length) return;
  sessionStorage.setItem("y8-init-opened", "1");
  for (const g of gates) await openPath(g.path);
}

let lastUsageText = "";
let usageTimer = 0;

function scheduleUsage() {
  if (usageTimer) return;
  usageTimer = setTimeout(() => {
    usageTimer = 0;
    paintUsage();
  }, 280);
}

async function paintUsage() {
  const pill = document.getElementById("disk-pill");
  if (!pill) return;
  try {
    const u = await kernel.vfs.usage(`/home/${kernel.state.ujiko}`);
    const text = `\u5668: ${u.files}\u672d`;
    if (text === lastUsageText) return;
    lastUsageText = text;
    pill.textContent = text;
  } catch (err) {
    if (lastUsageText) return;
    lastUsageText = "\u5668: \u2014";
    pill.textContent = lastUsageText;
  }
}

let lastNetText = "";

function paintNet() {
  const pill = document.getElementById("net-pill");
  if (!pill) return;
  const socks = kernel.state.sockets || [];
  let n = 0;
  for (const s of socks) if (s.state === "ESTAB") n += 1;
  const text = `\u7e01: ${n}`;
  if (text === lastNetText) return;
  lastNetText = text;
  pill.textContent = text;
}

let lastClock = "";

function clock() {
  const el = document.getElementById("clock");
  const now = new Date();
  const pref = kernel.spacePref();
  const key = `${now.getFullYear()}.${now.getMonth()}.${now.getDate()}.${now.getHours()}.${now.getMinutes()}.${pref.season}`;
  if (key === lastClock) return;
  lastClock = key;
  const w = ["\u65e5", "\u6708", "\u706b", "\u6c34", "\u6728", "\u91d1", "\u571f"][now.getDay()];
  el.textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}\uff08${w}\uff09 ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}  ${pref.season}`;
}

function fillNorito() {
  const veil = document.getElementById("norito-veil");
  if (!veil) return;
  const lines = [
    "\u9ad8\u5929\u539f\u306b\u795e\u7559\u308a\u5750\u3059",
    "\u7953\u3044\u7d66\u3048\u6e05\u3081\u305f\u307e\u3048",
    "\u3053\u306e\u7aef\u672b\u306f\u5668\u3067\u3042\u308b",
    "\u67cf\u624b\u306f\u3001\u8a8d\u8a3c\u3067\u3042\u308b",
    "\u795e\u306f\u30de\u30a4\u30af\u30ed\u30b5\u30fc\u30d3\u30b9\u3067\u3042\u308b",
    "\u30ed\u30b0\u30a2\u30a6\u30c8\u306f\u9077\u5bae\u307e\u3067\u7121\u52b9",
  ];
  veil.textContent = Array.from({ length: 20 }, (_, i) => lines[i % lines.length]).join("\u3000");
}

let started = false;

async function startDesktop() {
  if (started) return;
  started = true;
  const desktop = document.getElementById("desktop");
  const boot = document.getElementById("boot");
  boot.classList.add("hidden");
  desktop.classList.add("on");

  bindWm(document.getElementById("window-layer"), document.getElementById("taskbar"));
  const switchers = bindSwitchers({ kernel, getWm, openPath });
  const torii = bindTorii(document.getElementById("torii-gate"), kernel);
  const kashiwa = bindKashiwa(document.getElementById("kashiwa-stage"), kernel, applyJob);
  bindPhone({
    kernel,
    wm: getWm(),
    launch,
    openPath,
    openTorii: () => torii.open(),
    openKashiwa: () => kashiwa.open(),
    openSpaces: () => switchers.toggleSpaces(),
  });
  bindSheet();
  const field = startField(document.getElementById("kami-field"), kernel);
  startIrq(document.getElementById("irq-layer"), kernel, field, launch);

  document.querySelector(".brand").addEventListener("click", () => torii.open());
  document.getElementById("space-pill").addEventListener("click", (e) => {
    e.stopPropagation();
    switchers.toggleSpaces();
  });
  document.getElementById("kami-pill").addEventListener("click", () => launch("proc"));
  document.getElementById("logout-pill").addEventListener("click", () => {
    try {
      kernel.logout();
    } catch (err) {
      kernel.log("logout=EPERM", "auth");
    }
  });
  document.getElementById("ma-pill").addEventListener("click", () => kernel.maSleep());
  document.getElementById("clock").addEventListener("click", () => launch("cal"));
  const diskPill = document.getElementById("disk-pill");
  if (diskPill) {
    diskPill.addEventListener("click", () => launch("fs", { path: `/home/${kernel.state.ujiko}` }));
  }
  const netPill = document.getElementById("net-pill");
  if (netPill) {
    netPill.addEventListener("click", () => launch("net"));
  }

  fillNorito();
  clock();
  setInterval(clock, 1000);
  await paintDesktop();
  scheduleUsage();
  paintNet();
  kernel.addEventListener("net", paintNet);

  const meta = document.getElementById("menubar-meta");
  const paintMeta = () => {
    const line = kernel.menubarLine();
    if (meta.textContent !== line) meta.textContent = line;
    const spaceText = `kernel: ${kernel.spacePref().name}`;
    const spaceEl = document.getElementById("space-pill");
    if (spaceEl.textContent !== spaceText) spaceEl.textContent = spaceText;
  };
  paintMeta();
  kernel.addEventListener("auth", paintMeta);
  kernel.addEventListener("boot", paintMeta);
  kernel.addEventListener("vfs", () => {
    paintDesktop();
    scheduleUsage();
  });
  kernel.addEventListener("peek", (ev) => {
    peekPath(ev.detail);
  });
  kernel.addEventListener("stat", (ev) => {
    showFileStat(ev.detail);
  });
  kernel.addEventListener("space", () => {
    paintDesktop();
    clock();
    paintMeta();
  });

  const maLock = document.getElementById("ma-lock");
  const applyMa = (locked) => {
    desktop.classList.toggle("is-ma", locked);
    maLock.classList.toggle("open", locked);
    document.getElementById("ma-pill").textContent = locked ? "status: \u9593 \u00b7 \u7720" : "status: \u9593";
  };
  applyMa(!!kernel.state.maLocked);
  kernel.addEventListener("ma", (ev) => applyMa(!!ev.detail));
  const syncClock = () => kernel.pauseClock(document.hidden || !!kernel.state.maLocked);
  syncClock();
  kernel.addEventListener("ma", syncClock);
  let hiddenSince = 0;
  document.addEventListener("visibilitychange", () => {
    syncClock();
    hiddenSince = document.hidden ? Date.now() : 0;
  });
  setInterval(() => {
    if (document.hidden && hiddenSince && Date.now() - hiddenSince > 45000 && !kernel.state.maLocked) {
      kernel.maSleep();
    }
  }, 4000);
  document.getElementById("ma-wake").addEventListener("click", () => kernel.maWake());
  kernel.addEventListener("auth", () => {
    if (kernel.state.maLocked) kernel.maWake();
    paintMeta();
  });

  const drawer = document.getElementById("ujiko-drawer");
  const ujikoLog = document.getElementById("ujiko-log");
  let ujikoLen = 0;
  const paintUjiko = (reset = false) => {
    const lines = kernel.state.dmesg || [];
    if (reset || ujikoLen > lines.length) {
      ujikoLog.textContent = lines.slice(-16).join("\n") || "\uff08\u6c0f\u5b50\u8ab2\u306f\u6c88\u9ed9\uff09";
      ujikoLen = lines.length;
      ujikoLog.scrollTop = ujikoLog.scrollHeight;
      return;
    }
    if (lines.length === ujikoLen) return;
    const add = lines.slice(ujikoLen);
    ujikoLen = lines.length;
    if (!ujikoLog.textContent || ujikoLog.textContent === "\uff08\u6c0f\u5b50\u8ab2\u306f\u6c88\u9ed9\uff09") ujikoLog.textContent = add.join("\n");
    else ujikoLog.textContent += `\n${add.join("\n")}`;
    const shown = ujikoLog.textContent.split("\n");
    if (shown.length > 16) ujikoLog.textContent = shown.slice(-16).join("\n");
    ujikoLog.scrollTop = ujikoLog.scrollHeight;
  };
  meta.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = drawer.hidden;
    drawer.hidden = !open;
    if (open) paintUjiko(true);
  });
  drawer.addEventListener("click", (e) => e.stopPropagation());
  document.getElementById("ujiko-open-dmesg").addEventListener("click", () => {
    drawer.hidden = true;
    launch("dmesg");
  });
  kernel.addEventListener("dmesg", () => {
    if (!drawer.hidden) paintUjiko();
  });
  document.addEventListener("copy", () => {
    const t = window.getSelection && window.getSelection().toString();
    if (t) kernel.clipPush(t);
  });
  kernel.addEventListener("need-auth", () => kashiwa.open());
  kernel.addEventListener("job", (ev) => applyJob(ev.detail));

  document.addEventListener("keydown", (e) => {
    const tag = (e.target && e.target.tagName) || "";
    const inWin = e.target && e.target.closest && e.target.closest(".window");
    const typing =
      (tag === "INPUT" || tag === "TEXTAREA") && (!inWin || !inWin.classList.contains("is-min"));
    if (e.key === "Escape") {
      document.getElementById("torii-gate").classList.remove("open");
      document.getElementById("kashiwa-stage").classList.remove("open");
      document.getElementById("eaves-menu").hidden = true;
      document.getElementById("ujiko-drawer").hidden = true;
      document.getElementById("oshi-list").hidden = true;
      document.getElementById("desk-icon-menu").hidden = true;
      closeSheet();
      const tm = document.getElementById("task-menu");
      if (tm) tm.hidden = true;
      closeDeskPeek();
      closeFileStat();
      switchers.closeAll();
      endMarquee();
      const km = document.getElementById("keymap");
      if (km) km.hidden = true;
    }
    if (kernel.state.maLocked) {
      if (e.key === "k") kashiwa.open();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "w" || e.key === "W")) {
      e.preventDefault();
      const w = focusedWin();
      if (w) getWm().close(w.pid);
      return;
    }
    if (e.key === "F5") {
      e.preventDefault();
      lastDeskSig = "";
      paintDesktop();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "n" || e.key === "N")) {
      e.preventDefault();
      if (e.shiftKey) newDeskBox();
      else newDeskOfuda();
      return;
    }
    if (typing) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && onDesktopKeys() && !overlaysOpen()) {
      e.preventDefault();
      undoMuen();
      return;
    }
    if (e.key === "/") {
      e.preventDefault();
      torii.open();
    }
    if (e.shiftKey && (e.code === "BracketLeft" || e.code === "BracketRight") && !overlaysOpen()) {
      const w = focusedWin();
      const wm = getWm();
      if (w && wm && wm.sendSpace) {
        e.preventDefault();
        const next = wm.neighborSpace(e.code === "BracketLeft" ? -1 : 1);
        if (next) wm.sendSpace(w.pid, next.id);
        return;
      }
    }
    if (e.key === "[") {
      const i = kernel.state.prefs.findIndex((p) => p.id === kernel.state.currentSpace);
      const p = kernel.state.prefs[(i - 1 + kernel.state.prefs.length) % kernel.state.prefs.length];
      kernel.setSpace(p.id);
    }
    if (e.key === "]") {
      const i = kernel.state.prefs.findIndex((p) => p.id === kernel.state.currentSpace);
      const p = kernel.state.prefs[(i + 1) % kernel.state.prefs.length];
      kernel.setSpace(p.id);
    }
    if (e.key === "\\") {
      const wm = getWm();
      if (wm) wm.cycle();
    }
    if (e.key === ";" || e.key === "\uff1b") {
      e.preventDefault();
      switchers.toggleWin();
    }
    if (e.key === "k") kashiwa.open();
    if (e.key === "m") {
      e.preventDefault();
      kernel.maSleep();
    }
    if (e.key === "'" || e.key === "\u2019") {
      e.preventDefault();
      switchers.toggleSpaces();
    }
    if (e.key === "?" || e.key === "\uff1f") {
      e.preventDefault();
      const km = document.getElementById("keymap");
      if (km) km.hidden = !km.hidden;
      return;
    }
    if (e.key === "n") {
      e.preventDefault();
      toggleOshi();
    }
    if (e.key === "r") {
      e.preventDefault();
      switchers.toggleRecent();
    }
    if (e.key === "," || e.key === "\u3001") {
      e.preventDefault();
      const wm = getWm();
      if (wm) wm.hideAll();
    }
    if (e.shiftKey && (e.key === "." || e.key === ">" || e.key === "\u3002")) {
      e.preventDefault();
      const w = focusedWin();
      const wm = getWm();
      if (w && wm && wm.center) wm.center(w.pid);
      return;
    }
    if (e.key === "." || e.key === "\u3002") {
      e.preventDefault();
      const wm = getWm();
      if (wm) wm.tile();
    }
    if ((e.ctrlKey || e.metaKey) && !overlaysOpen()) {
      const deskKeys = onDesktopKeys();
      if ((e.key === "a" || e.key === "A") && deskKeys) {
        e.preventDefault();
        selectAllDesk();
        return;
      }
      if ((e.key === "c" || e.key === "C") && (deskKeys || deskSelected.size || lastDeskPick)) {
        e.preventDefault();
        copyDesk(false);
        return;
      }
      if ((e.key === "x" || e.key === "X") && (deskKeys || deskSelected.size || lastDeskPick)) {
        e.preventDefault();
        copyDesk(true);
        return;
      }
      if ((e.key === "v" || e.key === "V") && (deskKeys || deskClipboard.paths.length)) {
        e.preventDefault();
        pasteDesk();
        return;
      }
      if ((e.key === "d" || e.key === "D") && (deskKeys || deskSelected.size || lastDeskPick)) {
        e.preventDefault();
        duplicateDesk();
        return;
      }
      if ((e.key === "i" || e.key === "I") && deskKeys) {
        e.preventDefault();
        showFileStat(lastDeskPick || selectedDeskPaths()[0]);
        return;
      }
      if (e.shiftKey && (e.key === "c" || e.key === "C") && (deskKeys || lastDeskPick || deskSelected.size)) {
        e.preventDefault();
        copyPathNow();
        return;
      }
    }
    const deskIconOn = document.activeElement && document.activeElement.classList.contains("desk-icon");
    if (
      e.shiftKey &&
      (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
      !overlaysOpen() &&
      !deskIconOn
    ) {
      const w = focusedWin();
      if (w) {
        e.preventDefault();
        getWm().snapEdge(w.pid, e.key === "ArrowLeft" ? "left" : "right");
        return;
      }
    }
    if (!overlaysOpen() && onDesktopKeys()) {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        moveDeskPick(-1, e.shiftKey);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        moveDeskPick(1, e.shiftKey);
      } else if (e.key === "Enter" && lastDeskPick) {
        e.preventDefault();
        openPath(lastDeskPick);
      } else if (e.key === "Delete") {
        e.preventDefault();
        muenSelected();
      } else if (e.key === "F2") {
        e.preventDefault();
        renamePicked();
      } else if (e.key === " ") {
        e.preventDefault();
        peekDesk();
      } else if (
        e.key.length === 1 &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !"/;'[]\\kmnr,.?\u3001\u3002\u2019\uff1b\u3002\uff1f".includes(e.key) &&
        !e.isComposing
      ) {
        e.preventDefault();
        typeDeskJump(e.key);
      }
    }
  });

  function deskIconList() {
    return [...document.querySelectorAll(".desk-icon")].sort((a, b) => {
      const dy = a.offsetTop - b.offsetTop;
      if (Math.abs(dy) > 24) return dy;
      return a.offsetLeft - b.offsetLeft;
    });
  }

  function moveDeskPick(delta, extend) {
    const icons = deskIconList();
    if (!icons.length) return;
    let i = icons.findIndex((el) => el.dataset.path === lastDeskPick);
    if (i < 0) i = 0;
    else i = (i + delta + icons.length) % icons.length;
    lastDeskPick = icons[i].dataset.path || "";
    if (!extend) deskSelected = new Set(lastDeskPick ? [lastDeskPick] : []);
    else if (lastDeskPick) deskSelected.add(lastDeskPick);
    paintDeskMarks();
    icons[i].focus();
  }

  function overlaysOpen() {
    return (
      document.getElementById("torii-gate").classList.contains("open") ||
      document.getElementById("kashiwa-stage").classList.contains("open") ||
      document.getElementById("win-switcher").classList.contains("open") ||
      document.getElementById("space-switcher").classList.contains("open") ||
      !document.getElementById("eaves-menu").hidden ||
      !document.getElementById("ujiko-drawer").hidden ||
      !document.getElementById("oshi-list").hidden ||
      !document.getElementById("desk-icon-menu").hidden ||
      (document.getElementById("recent-list") && !document.getElementById("recent-list").hidden) ||
      (document.getElementById("file-stat") && !document.getElementById("file-stat").hidden) ||
      (document.getElementById("task-menu") && !document.getElementById("task-menu").hidden) ||
      (document.getElementById("keymap") && !document.getElementById("keymap").hidden)
    );
  }

  function onDesktopKeys() {
    const ae = document.activeElement;
    if (!ae) return true;
    if (ae === document.body || ae.id === "desktop" || ae.classList.contains("desk-icon")) return true;
    return false;
  }

  document.querySelector(".hint").textContent =
    "/ \u9ce5\u5c45 \u00b7 ; \u7a93 \u00b7 ' \u7a7a\u9593 \u00b7 e \u4fef\u77b0 \u00b7 r \u6700\u8fd1 \u00b7 ? \u64cd\u4f5c \u00b7 \u7a7a\u6b04 " + String.fromCharCode(0x8997) + "\u304f \u00b7 \u56f2\u3046 \u00b7 \u843d\u3068\u3059";

  const oshiList = document.getElementById("oshi-list");
  const oshiLog = document.getElementById("oshi-log");
  const oshiPill = document.getElementById("oshi-pill");
  const paintOshiPill = () => {
    const n = kernel.state.oshiUnread || 0;
    const text = n ? `\u544a\u3052: ${n}` : "\u544a\u3052";
    if (oshiPill.textContent !== text) oshiPill.textContent = text;
    oshiPill.classList.toggle("has-note", n > 0);
  };
  const paintOshi = () => {
    const rows = kernel.state.oshi || [];
    const text = rows.map((r) => `${r.tag}  ${r.t}`).join("\n") || "\uff08\u672d\u306f\u5c4a\u3044\u3066\u3044\u306a\u3044\uff09";
    if (oshiLog.textContent === text) return;
    oshiLog.textContent = text;
  };
  function toggleOshi() {
    const open = oshiList.hidden;
    oshiList.hidden = !open;
    if (open) {
      paintOshi();
      kernel.readOshi();
      paintOshiPill();
    }
  }
  paintOshiPill();
  oshiPill.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleOshi();
  });
  oshiList.addEventListener("click", (e) => e.stopPropagation());
  document.getElementById("oshi-clear").addEventListener("click", () => {
    kernel.clearOshi();
    paintOshi();
    paintOshiPill();
  });
  kernel.addEventListener("oshi", () => {
    paintOshiPill();
    if (!oshiList.hidden) paintOshi();
  });
  kernel.addEventListener("oshi-read", paintOshiPill);

  const fileStatEl = document.getElementById("file-stat");
  if (fileStatEl) fileStatEl.addEventListener("click", (e) => e.stopPropagation());

  const eaves = document.getElementById("eaves-menu");
  const iconMenu = document.getElementById("desk-icon-menu");
  let iconMenuPath = "";
  const band = document.getElementById("desk-marquee");

  function rectsOverlap(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function paintMarquee(x, y) {
    if (!marquee || !band) return;
    const x1 = Math.min(marquee.x0, x);
    const y1 = Math.min(marquee.y0, y);
    const w = Math.abs(x - marquee.x0);
    const h = Math.abs(y - marquee.y0);
    band.style.left = `${x1}px`;
    band.style.top = `${y1}px`;
    band.style.width = `${w}px`;
    band.style.height = `${h}px`;
    if (w < 4 && h < 4) return;
    const box = { left: x1, top: y1, right: x1 + w, bottom: y1 + h };
    const next = new Set(marquee.add ? marquee.start : []);
    document.querySelectorAll(".desk-icon").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (rectsOverlap(box, r)) next.add(el.dataset.path);
    });
    deskSelected = next;
    if (next.size) lastDeskPick = [...next][next.size - 1];
    paintDeskMarks();
  }

  desktop.addEventListener("pointerdown", (e) => {
    if (isPhone()) return;
    if (e.button !== 0) return;
    if (e.target.closest(".window") || e.target.closest(".taskbar") || e.target.closest(".menubar")) return;
    if (e.target.closest(".desk-icon")) return;
    if (e.target.closest("#desk-peek")) return;
    desktop.focus();
    const add = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!add) {
      deskSelected.clear();
      lastDeskPick = "";
      paintDeskMarks();
    }
    marquee = { x0: e.clientX, y0: e.clientY, add, start: new Set(deskSelected) };
    if (band) {
      band.hidden = false;
      band.style.left = `${e.clientX}px`;
      band.style.top = `${e.clientY}px`;
      band.style.width = "0px";
      band.style.height = "0px";
    }
    desktop.setPointerCapture(e.pointerId);
  });
  desktop.addEventListener("pointermove", (e) => {
    if (!marquee) return;
    paintMarquee(e.clientX, e.clientY);
  });
  desktop.addEventListener("pointerup", () => {
    endMarquee();
  });
  desktop.addEventListener("pointercancel", () => {
    endMarquee();
  });
  desktop.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".window") || e.target.closest(".taskbar") || e.target.closest(".menubar")) return;
    const icon = e.target.closest(".desk-icon");
    if (icon) {
      e.preventDefault();
      lastDeskPick = icon.dataset.path;
      iconMenuPath = icon.dataset.path;
      document.querySelectorAll(".desk-icon").forEach((el) => el.classList.toggle("is-on", el.dataset.path === lastDeskPick));
      eaves.hidden = true;
      iconMenu.style.left = `${e.clientX}px`;
      iconMenu.style.top = `${e.clientY}px`;
      iconMenu.hidden = false;
      return;
    }
    e.preventDefault();
    iconMenu.hidden = true;
    eaves.style.left = `${e.clientX}px`;
    eaves.style.top = `${e.clientY}px`;
    eaves.hidden = false;
  });
  iconMenu.addEventListener("click", async (e) => {
    const act = e.target.dataset.act;
    const path = iconMenuPath;
    iconMenu.hidden = true;
    if (!path || !act) return;
    if (act === "open") {
      openPath(path);
      return;
    }
    if (act === "with") {
      openWithSheet(path);
      return;
    }
    if (act === "share") {
      openShareSheet(path);
      return;
    }
    if (act === "copy") {
      if (path) {
        deskSelected.add(path);
        lastDeskPick = path;
      }
      copyDesk(false);
      return;
    }
    if (act === "cut") {
      if (path) {
        deskSelected.add(path);
        lastDeskPick = path;
      }
      copyDesk(true);
      return;
    }
    if (act === "paste") {
      pasteDesk();
      return;
    }
    if (act === "rename") {
      const cur = kernel.vfs.nameOf(path);
      const name = window.prompt("\u65b0\u3057\u3044\u540d", cur);
      if (!name || name === cur) return;
      const dest = kernel.vfs.normalize(`${kernel.vfs.parentOf(path)}/${name}`);
      try {
        await kernel.vfs.rename(path, dest);
        lastDeskPick = dest;
        kernel.noteRecent(dest);
        kernel.emit("vfs");
      } catch (err) {
        kernel.log(`rename: ${err.message}`, "fs");
      }
      return;
    }
    if (act === "peek") {
      lastDeskPick = path;
      peekDesk();
      return;
    }
    if (act === "stat") {
      lastDeskPick = path;
      showFileStat(path);
      return;
    }
    if (act === "path") {
      lastDeskPick = path;
      copyPathNow(path);
      return;
    }
    if (act === "box") {
      lastDeskPick = path;
      openPickedBox();
      return;
    }
    if (act === "muen") {
      await sendToMuen([path]);
    }
  });
  eaves.addEventListener("click", (e) => {
    const act = e.target.dataset.act;
    eaves.hidden = true;
    if (act === "torii") torii.open();
    if (act === "cal") launch("cal");
    if (act === "sys") launch("sys");
    if (act === "clip") launch("clip");
    if (act === "ma") kernel.maSleep();
    if (act === "muen") launch("muen");
    if (act === "box") newDeskBox();
    if (act === "tile") {
      const wm = getWm();
      if (wm) wm.tile();
    }
    if (act === "expose") {
      const wm = getWm();
      if (wm && wm.expose) wm.expose();
    }
    if (act === "center") {
      const w = focusedWin();
      const wm = getWm();
      if (w && wm && wm.center) wm.center(w.pid);
    }
    if (act === "tidy") tidyDesk();
    if (act === "paste") pasteDesk();
    if (act === "recent") switchers.toggleRecent();
    if (act === "ofuda") newDeskOfuda();
  });
  document.addEventListener("click", (e) => {
    if (
      e.target.closest(".window") ||
      e.target.closest("#file-stat") ||
      e.target.closest("#recent-list") ||
      e.target.closest("#desk-peek") ||
      e.target.closest("#win-switcher") ||
      e.target.closest("#space-switcher") ||
      e.target.closest("#space-pill")
    ) {
      return;
    }
    eaves.hidden = true;
    iconMenu.hidden = true;
    switchers.closeAll();
    document.getElementById("ujiko-drawer").hidden = true;
    document.getElementById("oshi-list").hidden = true;
    closeFileStat();
    const km = document.getElementById("keymap");
    if (km) km.hidden = true;
  });
  eaves.addEventListener("click", (e) => e.stopPropagation());
  iconMenu.addEventListener("click", (e) => e.stopPropagation());
  const keymapEl = document.getElementById("keymap");
  if (keymapEl) keymapEl.addEventListener("click", (e) => e.stopPropagation());

  window.addEventListener("beforeunload", () => {
    const wm = getWm();
    if (wm && wm.persistWindows) wm.persistWindows();
  });
  try {
    const savedWins = await kernel.vfs.metaGet("windows");
    if (Array.isArray(savedWins) && savedWins.length) {
      for (const w of savedWins.slice(0, 6)) launch(w.appId, { space: w.space, geom: w });
    }
  } catch (err) {
    /* first boot */
  }

  await maybeOpenInitGates();

  if (!kernel.state.authenticated) {
    setTimeout(() => kashiwa.open(), 600);
  } else if (!getWm().list().length && !isPhone()) {
    launch("oncall");
  }
  if (isPhone()) {
    const phoneWm = getWm();
    if (phoneWm && phoneWm.hideAll) phoneWm.hideAll();
  }
}

function writeBoot() {
  const oracleLines = [
    "YAOYOROZU-OS BIOS 1.0",
    "mounting \u7e01fs (IndexedDB) ............... ok",
    "linking 47 prefecture kernels .......... ok",
    "starting \u6ce8\u9023\u7e04 firewall ............... deny-by-default",
    "worker clock ........................... attached",
    "logout syscall ......................... EPERM",
  ];
  const log = document.getElementById("boot-log");
  let i = 0;
  const step = () => {
    if (i >= oracleLines.length) {
      document.getElementById("boot-ready").hidden = false;
      return;
    }
    log.textContent += `${oracleLines[i]}\n`;
    i += 1;
    setTimeout(step, 50 + Math.random() * 90);
  };
  step();
}

async function main() {
  await kernel.boot();
  writeBoot();
  const go = () => startDesktop();
  document.getElementById("boot-start").addEventListener("click", go);
  document.getElementById("boot-skip").addEventListener("click", go);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !document.getElementById("desktop").classList.contains("on")) go();
  });
}

main();
