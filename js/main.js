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
  document.getElementById("space-pill").textContent = `kernel: ${pref.name}`;
  document.getElementById("kami-pill").textContent = `kami: ${kernel.state.processes.filter((p) => p.kind !== "app").length}`;
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
      dragging = true;
      moved = false;
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
      btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const x = Math.max(8, e.clientX - ox);
      const y = Math.max(48, e.clientY - oy);
      const dx = x - sx;
      const dy = y - sy;
      if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
      for (const g of group) {
        g.el.style.left = `${Math.max(8, g.x + dx)}px`;
        g.el.style.top = `${Math.max(48, g.y + dy)}px`;
      }
    });
    btn.addEventListener("pointerup", (e) => {
      dragging = false;
      lastDeskPick = f.path;
      if (moved) {
        for (const g of group) {
          pos[g.path] = { x: g.el.offsetLeft, y: g.el.offsetTop };
        }
        deskPos = pos;
        saveDeskPos();
        return;
      }
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        if (deskSelected.has(f.path)) deskSelected.delete(f.path);
        else deskSelected.add(f.path);
        paintDeskMarks();
        return;
      }
      deskSelected = new Set([f.path]);
      paintDeskMarks();
      openPath(f.path);
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
  const src = await kernel.vfs.getFile(from);
  if (!src) throw new Error("ENOENT");
  if (src.type === "dir") {
    await kernel.vfs.mkdir(to);
    const kids = await kernel.vfs.ls(from);
    for (const k of kids) {
      await copyTree(k.path, kernel.vfs.normalize(`${to}/${k.name}`));
    }
    return;
  }
  await kernel.vfs.copy(from, to);
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
  deskClipboard = { mode: cut ? "cut" : "copy", paths };
  paintDeskMarks();
  kernel.clipPush(paths.join("\n"));
  kernel.log(cut ? "\u5353\u3092\u5207\u3063\u305f" : "\u5353\u3092\u5199\u3057\u305f", "desk");
}
