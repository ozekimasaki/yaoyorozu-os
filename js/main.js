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
  if (sig === lastDeskSig && icons.children.length) return;
  lastDeskSig = sig;
  const pos = await loadDeskPos();
  icons.innerHTML = "";
  rows.forEach((f, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `desk-icon${f.path === lastDeskPick ? " is-on" : ""}`;
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
    btn.addEventListener("pointerdown", (e) => {
      dragging = true;
      moved = false;
      sx = btn.offsetLeft;
      sy = btn.offsetTop;
      ox = e.clientX - sx;
      oy = e.clientY - sy;
      btn.setPointerCapture(e.pointerId);
    });
    btn.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const x = Math.max(8, e.clientX - ox);
      const y = Math.max(48, e.clientY - oy);
      if (Math.abs(x - sx) + Math.abs(y - sy) > 6) moved = true;
      btn.style.left = `${x}px`;
      btn.style.top = `${y}px`;
    });
    btn.addEventListener("pointerup", () => {
      dragging = false;
      lastDeskPick = f.path;
      icons.querySelectorAll(".desk-icon").forEach((el) => el.classList.toggle("is-on", el.dataset.path === f.path));
      if (moved) {
        pos[f.path] = { x: btn.offsetLeft, y: btn.offsetTop };
        deskPos = pos;
        saveDeskPos();
        return;
      }
      openPath(f.path);
    });
    icons.appendChild(btn);
  });
}

let lastClock = "";

function clock() {
  const el = document.getElementById("clock");
  const now = new Date();
  const pref = kernel.spacePref();
  const key = `${now.getFullYear()}.${now.getMonth()}.${now.getDate()}.${now.getHours()}.${now.getMinutes()}.${pref.season}`;
  if (key === lastClock) return;
  lastClock = key;
  const w = ["日", "月", "火", "水", "木", "金", "土"][now.getDay()];
  el.textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}(×${w}Ø ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}  ${pref.season}`;
}
