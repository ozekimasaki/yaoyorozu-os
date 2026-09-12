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
  const icons = document.g