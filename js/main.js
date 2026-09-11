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
  el.textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}（${w}） ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}  ${pref.season}`;
}

function fillNorito() {
  const veil = document.getElementById("norito-veil");
  if (!veil) return;
  const lines = [
    "高天原に神留り坐す",
    "祓い給え清めたまえ",
    "この端末は器である",
    "柏手は、認証である",
    "神はマイクロサービスである",
    "ログアウトは遷宮まで無効",
  ];
  veil.textContent = Array.from({ length: 20 }, (_, i) => lines[i % lines.length]).join("　");
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
  const torii = bindTorii(document.getElementById("torii-gate"), kernel);
  const kashiwa = bindKashiwa(document.getElementById("kashiwa-stage"), kernel, applyJob);
  const field = startField(document.getElementById("kami-field"), kernel);
  startIrq(document.getElementById("irq-layer"), kernel, field, launch);

  document.querySelector(".brand").addEventListener("click", () => torii.open());
  document.getElementById("space-pill").addEventListener("click", () => toggleSpaces());
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

  fillNorito();
  clock();
  setInterval(clock, 1000);
  await paintDesktop();

  const meta = document.getElementById("menubar-meta");
  const paintMeta = () => {
    meta.textContent = kernel.menubarLine();
    document.getElementById("space-pill").textContent = `kernel: ${kernel.spacePref().name}`;
  };
  paintMeta();
  kernel.addEventListener("auth", paintMeta);
  kernel.addEventListener("boot", paintMeta);
  kernel.addEventListener("vfs", paintDesktop);
  kernel.addEventListener("space", () => {
    paintDesktop();
    clock();
    paintMeta();
  });

  const maLock = document.getElementById("ma-lock");
  const applyMa = (locked) => {
    desktop.classList.toggle("is-ma", locked);
    maLock.classList.toggle("open", locked);
    document.getElementById("ma-pill").textContent = locked ? "status: 間 · 眠" : "status: 間";
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
      ujikoLog.textContent = lines.slice(-16).join("\n") || "（氏子課は沈黙）";
      ujikoLen = lines.length;
      ujikoLog.scrollTop = ujikoLog.scrollHeight;
      return;
    }
    if (lines.length === ujikoLen) return;
    const add = lines.slice(ujikoLen);
    ujikoLen = lines.length;
    if (!ujikoLog.textContent || ujikoLog.textContent === "（氏子課は沈黙）") ujikoLog.textContent = add.join("\n");
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
      document.getElementById("win-switcher").classList.remove("open");
      document.getElementById("eaves-menu").hidden = true;
      document.getElementById("ujiko-drawer").hidden = true;
      document.getElementById("space-switcher").classList.remove("open");
      document.getElementById("oshi-list").hidden = true;
      document.getElementById("desk-icon-menu").hidden = true;
    }
    if (kernel.state.maLocked) {
      if (e.key === "k") kashiwa.open();
      return;
    }
    if (typing) return;
    if (e.key === "/") {
      e.preventDefault();
      torii.open();
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
    if (e.key === ";" || e.key === "；") {
      e.preventDefault();
      toggleSwitcher();
    }
    if (e.key === "k") kashiwa.open();
    if (e.key === "m") {
      e.preventDefault();
      kernel.maSleep();
    }
    if (e.key === "'" || e.key === "’") {
      e.preventDefault();
      toggleSpaces();
    }
    if (e.key === "n") {
      e.preventDefault();
      toggleOshi();
    }
    if (e.key === "," || e.key === "、") {
      e.preventDefault();
      const wm = getWm();
      if (wm) wm.hideAll();
    }
    if (!overlaysOpen() && onDesktopKeys()) {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        moveDeskPick(-1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        moveDeskPick(1);
      } else if (e.key === "Enter" && lastDeskPick) {
        e.preventDefault();
        openPath(lastDeskPick);
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

  function moveDeskPick(delta) {
    const icons = deskIconList();
    if (!icons.length) return;
    let i = icons.findIndex((el) => el.classList.contains("is-on"));
    if (i < 0) i = 0;
    else i = (i + delta + icons.length) % icons.length;
    lastDeskPick = icons[i].dataset.path || "";
    icons.forEach((el, idx) => el.classList.toggle("is-on", idx === i));
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
      !document.getElementById("desk-icon-menu").hidden
    );
  }

  function onDesktopKeys() {
    const ae = document.activeElement;
    if (!ae) return true;
    if (ae === document.body || ae.id === "desktop" || ae.classList.contains("desk-icon")) return true;
    return false;
  }

  document.querySelector(".hint").textContent = "/ 鳥居 · ; 窓 · ' 空間 · , 席 · n 告げ · ↑↓ 札 · k 柏手 · m 間";

  const switcher = document.getElementById("win-switcher");
  function toggleSwitcher() {
    if (switcher.classList.contains("open")) {
      switcher.classList.remove("open");
      return;
    }
    const wm = getWm();
    const wins = wm ? wm.list().filter((w) => !w.el.classList.contains("is-away")) : [];
    switcher.innerHTML = wins.length
      ? wins
          .map(
            (w) =>
              `<button type="button" data-pid="${w.pid}">${w.title}<small>${w.appId} · ${w.pid}</small></button>`
          )
          .join("")
      : `<p class="muted">走っている窓はない。鳥居をくぐれ。</p>`;
    switcher.classList.add("open");
    switcher.querySelectorAll("[data-pid]").forEach((btn) => {
      btn.onclick = () => {
        wm.restore(Number(btn.dataset.pid));
        wm.focus(Number(btn.dataset.pid));
        switcher.classList.remove("open");
      };
    });
  }

  const spaces = document.getElementById("space-switcher");
  function toggleSpaces() {
    if (spaces.classList.contains("open")) {
      spaces.classList.remove("open");
      return;
    }
    const here = kernel.state.currentSpace;
    spaces.innerHTML = kernel.state.prefs
      .map(
        (p) =>
          `<button type="button" class="${p.id === here ? "is-here" : ""}" data-id="${p.id}">${p.name}<small>未使用CPU ${p.unusedCpu}% · ${p.season}</small></button>`
      )
      .join("");
    spaces.classList.add("open");
    spaces.querySelectorAll("[data-id]").forEach((btn) => {
      btn.onclick = () => {
        kernel.setSpace(btn.dataset.id);
        spaces.classList.remove("open");
      };
    });
  }

  const oshiList = document.getElementById("oshi-list");
  const oshiLog = document.getElementById("oshi-log");
  const oshiPill = document.getElementById("oshi-pill");
  const paintOshiPill = () => {
    const n = kernel.state.oshiUnread || 0;
    oshiPill.textContent = n ? `告げ: ${n}` : "告げ";
    oshiPill.classList.toggle("has-note", n > 0);
  };
  const paintOshi = () => {
    const rows = kernel.state.oshi || [];
    oshiLog.textContent = rows.map((r) => `${r.tag}  ${r.t}`).join("\n") || "（札は届いていない）";
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

  const eaves = document.getElementById("eaves-menu");
  const iconMenu = document.getElementById("desk-icon-menu");
  let iconMenuPath = "";
  desktop.addEventListener("mousedown", (e) => {
    if (e.target.closest(".window") || e.target.closest(".taskbar") || e.target.closest(".menubar")) return;
    if (e.target.closest(".desk-icon")) return;
    desktop.focus();
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
    if (act === "copy") {
      kernel.clipPush(path);
      return;
    }
    if (act === "rename") {
      const cur = kernel.vfs.nameOf(path);
      const name = window.prompt("新しい名", cur);
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
    if (act === "muen") {
      try {
        await kernel.vfs.moveToMuen(path);
        lastDeskPick = "";
        kernel.emit("vfs");
      } catch (err) {
        kernel.log(`muen: ${err.message}`, "fs");
      }
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
    if (act === "box") {
      const path = `/home/${kernel.state.ujiko}/desktop/匣-${Date.now()}`;
      kernel.vfs.mkdir(path).then(() => kernel.emit("vfs"));
    }
    if (act === "ofuda") {
      const path = `/home/${kernel.state.ujiko}/desktop/${Date.now()}.ofuda`;
      kernel.vfs.write(path, "名を書け。空のスローガンはコンパイルされない。", "text/plain").then(() => {
        kernel.emit("vfs");
        launch("editor", { path });
      });
    }
  });
  document.addEventListener("click", () => {
    eaves.hidden = true;
    iconMenu.hidden = true;
    switcher.classList.remove("open");
    document.getElementById("ujiko-drawer").hidden = true;
    document.getElementById("oshi-list").hidden = true;
    document.getElementById("space-switcher").classList.remove("open");
  });
  switcher.addEventListener("click", (e) => e.stopPropagation());
  spaces.addEventListener("click", (e) => e.stopPropagation());
  eaves.addEventListener("click", (e) => e.stopPropagation());
  iconMenu.addEventListener("click", (e) => e.stopPropagation());

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

  if (!kernel.state.authenticated) {
    setTimeout(() => kashiwa.open(), 600);
  } else if (!getWm().list().length) {
    launch("oncall");
  }
}

function writeBoot() {
  const oracleLines = [
    "YAOYOROZU-OS BIOS 1.0",
    "mounting 縁fs (IndexedDB) ............... ok",
    "linking 47 prefecture kernels .......... ok",
    "starting 注連縄 firewall ............... deny-by-default",
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
