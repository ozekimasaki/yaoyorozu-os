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
import { bindTorii } from "./apps/torii.js";
import { bindKashiwa } from "./kashiwa.js";
import { startField } from "./field.js";
import { startIrq } from "./irq.js";

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
let switcherIndex = 0;
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
    btn.textContent = f.name.replace(".gate", "");
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
    kernel.log(`札を${w.title}へ落とした`, "desk");
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
  kernel.log(cut ? "卓を切った" : "卓を写した", "desk");
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
            kernel.log("匣の切りは写して残す", "desk");
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
      kernel.log(`貼る: ${err.message}`, "desk");
    }
  }
  if (deskClipboard.mode === "cut") {
    deskClipboard = { mode: "copy", paths: [] };
    kernel.clipVfs("copy", []);
  }
  deskSelected.clear();
  kernel.emit("vfs");
  kernel.log(`卓に貼った ×${n}`, "desk");
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
  kernel.log("札を揃えた", "desk");
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
    kernel.log("戻す札はない", "desk");
    return;
  }
  try {
    const to = await kernel.vfs.restoreFromMuen(rec.dest, rec.origin);
    lastDeskPick = to;
    deskSelected = new Set([to]);
    kernel.noteRecent(to);
    kernel.emit("vfs");
    kernel.log(`無縁から戻した ${to}`, "desk");
  } catch (err) {
    kernel.log(`戻す: ${err.message}`, "desk");
  }
}

async function newDeskOfuda() {
  const path = `/home/${kernel.state.ujiko}/desktop/${Date.now()}.ofuda`;
  await kernel.vfs.write(path, "名を書け。空のスローガンはコンパイルされない。", "text/plain");
  lastDeskPick = path;
  kernel.emit("vfs");
  launch("editor", { path });
}

async function newDeskBox() {
  const path = `/home/${kernel.state.ujiko}/desktop/匣-${Date.now()}`;
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

async function peekPath(path) {
  const box = document.getElementById("desk-peek");
  if (!box) return;
  if (!path) {
    box.hidden = true;
    return;
  }
  if (!box.hidden && box.dataset.path === path) {
    box.hidden = true;
    return;
  }
  const title = document.getElementById("desk-peek-path");
  const body = document.getElementById("desk-peek-body");
  title.textContent = path;
  box.dataset.path = path;
  try {
    const node = path === "/" ? { type: "dir" } : await kernel.vfs.getFile(path);
    if (!node) {
      body.textContent = "ENOENT";
    } else if (node.type === "dir") {
      const kids = await kernel.vfs.ls(path);
      body.textContent = kids.map((k) => `${k.type === "dir" ? "▸" : "·"} ${k.name}`).join("\n") || "（空の匣）";
    } else if (node.type === "link") {
      body.textContent = `↦ ${node.target || node.body || ""}`;
    } else if ((path.endsWith(".gate") || node.mime === "gate/app") && node.body) {
      body.textContent = `くぐると起動: ${String(node.body).trim()}`;
    } else {
      body.textContent = String(node.body || "").split("\n").slice(0, 24).join("\n") || "（空の札）";
    }
  } catch (err) {
    body.textContent = err.message;
  }
  box.hidden = false;
}

async function peekDesk() {
  await peekPath(lastDeskPick || selectedDeskPaths()[0]);
}

function closeDeskPeek() {
  const box = document.getElementById("desk-peek");
  if (box) {
    box.hidden = true;
    box.dataset.path = "";
  }
}

function fmtWhen(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function kindLabel(node, path) {
  if (!node) return "無い";
  if (node.type === "dir") return "匣";
  if (node.type === "link") return "結び";
  if ((path && path.endsWith(".gate")) || node.mime === "gate/app") return "鳥居";
  return "札";
}

async function showFileStat(path) {
  const box = document.getElementById("file-stat");
  if (!box) return;
  if (!path) {
    box.hidden = true;
    return;
  }
  if (!box.hidden && box.dataset.path === path) {
    box.hidden = true;
    return;
  }
  closeDeskPeek();
  const title = document.getElementById("file-stat-path");
  const body = document.getElementById("file-stat-body");
  title.textContent = path;
  box.dataset.path = path;
  try {
    const node = path === "/" ? { type: "dir", mime: "inode/directory", updated: 0 } : await kernel.vfs.getFile(path);
    if (!node) {
      body.textContent = "ENOENT";
    } else {
      const lines = [`種  ${kindLabel(node, path)}`, `型  ${node.mime || "—"}`];
      if (node.type === "link") lines.push(`先  ${node.target || node.body || "—"}`);
      if (node.type === "file" || node.type === "link") {
        lines.push(`量  ${(node.body || "").length}B`);
        lines.push(`行  ${node.exec ? "くぐれる" : "読む"}`);
      }
      if (node.type === "dir") {
        try {
          const u = await kernel.vfs.usage(path);
          lines.push(`量 匣${u.dirs} · 札${u.files} · ${u.bytes}B`);
        } catch (err) {
          lines.push("量  —");
        }
      }
      if (node.origin) lines.push(`元  ${node.origin}`);
      lines.push(`時  ${fmtWhen(node.updated)}`);
      const text = lines.join("\n");
      if (body.textContent !== text) body.textContent = text;
    }
  } catch (err) {
    body.textContent = err.message;
  }
  box.hidden = false;
}

function closeFileStat() {
  const box = document.getElementById("file-stat");
  if (box) {
    box.hidden = true;
    box.dataset.path = "";
  }
}

function closeRecent() {
  const box = document.getElementById("recent-list");
  if (box) box.hidden = true;
}

function copyPathNow(path) {
  const p = path || lastDeskPick || selectedDeskPaths()[0];
  if (!p) return;
  kernel.clipPush(p);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(p).catch(() => {});
  }
  kernel.log(`道を写した ${p}`, "desk");
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
  const name = window.prompt("新しい名", cur);
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
  if (sessionStorage.getItem("y8-i