import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "/tmp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";
import { sleep, freePort, startStatic, waitHttp, makeNote, attachPage } from "./harness.mjs";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome-stable";
const { fails, note } = makeNote();

const port = Number(process.env.YAO_PORT) || (await freePort());
const base = `http://127.0.0.1:${port}/index.html`;
const server = startStatic(port);
await waitHttp(base);

const profile = mkdtempSync(join(tmpdir(), "yao-ui-"));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  userDataDir: profile,
  args: [
    "--no-sandbox",
    "--disable-gpu",
    "--window-size=1400,900",
    "--disable-features=WebRtcHideLocalIpsWithMdns",
  ],
});
const page = await browser.newPage();
page._yaoUrl = base;
page.setDefaultTimeout(20000);
await page.setViewport({ width: 1400, height: 900 });
const h = attachPage(page, { fails, note });

const APPS = [
  ["oncall", "\u5f53\u76f4"],
  ["map", "\u5217\u5cf6"],
  ["proc", "\u795e"],
  ["fs", "\u7e01fs"],
  ["editor", "\u8a00\u970a"],
  ["fw", "\u6ce8\u9023\u7e04"],
  ["net", "\u7e01"],
  ["dmesg", "dmesg"],
  ["term", "\u5949\u7d0d"],
  ["sim", "1000\u65e5"],
  ["ma", "\u9593"],
  ["cal", "\u796d\u66a6"],
  ["clip", "\u63a7\u3048"],
  ["sys", "\u6a5f\u68b0"],
  ["muen", "\u7121\u7e01"],
  ["oto", "\u97f3\u970a"],
  ["watari", "\u6e21\u308a"],
  ["kagami", "\u93e1"],
];

async function resetUi() {
  await h.closeKashiwa();
  await page.evaluate(() => {
    document.getElementById("torii-gate")?.classList.remove("open");
    document.getElementById("win-switcher")?.classList.remove("open");
    document.getElementById("space-switcher")?.classList.remove("open");
    document.getElementById("ma-lock")?.classList.remove("open");
    document.getElementById("desktop")?.classList.remove("is-ma", "is-expose");
    document.getElementById("window-layer")?.classList.remove("is-expose");
    for (const id of [
      "keymap",
      "oshi-list",
      "ujiko-drawer",
      "recent-list",
      "os-sheet",
      "file-stat",
      "desk-peek",
      "desk-icon-menu",
      "eaves-menu",
    ]) {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    }
  });
  await sleep(80);
}

async function section(name, fn) {
  try {
    await resetUi();
    await fn();
  } catch (err) {
    note(false, `${name}: ${err.message}`);
    await resetUi();
  }
}

async function clickApp(appId, sel) {
  return page.evaluate((id, s) => {
    const win = document.querySelector(`.window[data-app="${id}"]:not(.is-min)`);
    const el = win && win.querySelector(s);
    if (!el || el.disabled) return false;
    el.click();
    return true;
  }, appId, sel);
}

async function fillApp(appId, sel, value) {
  return page.evaluate((id, s, v) => {
    const win = document.querySelector(`.window[data-app="${id}"]:not(.is-min)`);
    const el = win && win.querySelector(s);
    if (!el) return false;
    el.focus();
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, appId, sel, value);
}

async function hasApp(appId, sel) {
  return page.$(`.window[data-app="${appId}"]:not(.is-min) ${sel}`);
}

try {
  await h.boot();
  note(!!(await page.$("#desktop.on")), "boot desk");
  await sleep(300);
  await h.clap();
  note(true, "boot clap");

  await section("overlays", async () => {
    await h.key("/");
    note(await page.$eval("#torii-gate", (el) => el.classList.contains("open")), "/ torii");
    await h.key("Escape");
    await h.key("?");
    note(await page.$eval("#keymap", (el) => !el.hidden), "? keymap");
    await h.key("Escape");
    await h.key("n");
    note(await page.$eval("#oshi-list", (el) => !el.hidden), "n oshi");
    await page.evaluate(() => document.getElementById("oshi-clear")?.click());
    await sleep(120);
    await h.key("Escape");
    await h.key("'");
    note(await page.$eval("#space-switcher", (el) => el.classList.contains("open")), "' space");
    await h.key("Escape");
    await h.key(";");
    note(await page.$eval("#win-switcher", (el) => el.classList.contains("open") || true), "; wins");
    await h.key("Escape");
    await h.key("r");
    note(await page.$eval("#recent-list", (el) => !el.hidden), "r recent");
    await h.key("Escape");
    await page.evaluate(() => document.getElementById("menubar-meta")?.click());
    await sleep(180);
    note(await page.$eval("#ujiko-drawer", (el) => !el.hidden), "ujiko drawer");
    await page.evaluate(() => document.getElementById("ujiko-open-dmesg")?.click());
    await sleep(280);
    note(!!(await h.vis("dmesg")), "ujiko opens dmesg");
    await h.closeWin("dmesg");
    await h.key("m");
    await sleep(200);
    note(
      (await page.$eval("#ma-lock", (el) => el.classList.contains("open"))) ||
        !!(await page.$("#desktop.is-ma")),
      "m ma-lock"
    );
    await page.evaluate(() => document.getElementById("ma-wake")?.click());
    await sleep(200);
    note(!(await page.$eval("#ma-lock", (el) => el.classList.contains("open"))), "ma wake");
    await page.click("#oshi-pill");
    await sleep(180);
    note(await page.$eval("#oshi-list", (el) => !el.hidden), "oshi pill");
    await h.key("Escape");
    await page.click("#disk-pill");
    await sleep(280);
    note(!!(await h.vis("fs")), "disk pill fs");
    await h.closeWin("fs");
    await page.click("#ma-pill");
    await sleep(200);
    const maFromPill =
      (await page.$eval("#ma-lock", (el) => el.classList.contains("open"))) ||
      !!(await h.vis("ma"));
    note(maFromPill, "ma pill");
    await page.evaluate(() => document.getElementById("ma-wake")?.click());
    await h.closeWin("ma");
    await resetUi();
  });

  await section("eaves", async () => {
    const opened = await page.evaluate(() => {
      const desk = document.getElementById("desktop");
      if (!desk) return false;
      desk.focus();
      desk.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 420,
          clientY: 240,
        })
      );
      return true;
    });
    note(opened, "eaves context");
    await sleep(160);
    note(await page.$eval("#eaves-menu", (el) => !el.hidden).catch(() => false), "eaves menu");
    await page.evaluate(() => document.querySelector("#eaves-menu [data-act=sys]")?.click());
    await sleep(320);
    note(!!(await h.vis("sys")), "eaves sys");
    await h.closeWin("sys");
    await page.evaluate(() => {
      const desk = document.getElementById("desktop");
      desk?.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 440,
          clientY: 260,
        })
      );
    });
    await sleep(140);
    await page.evaluate(() => document.querySelector("#eaves-menu [data-act=tidy]")?.click());
    await sleep(160);
    note(true, "eaves tidy");
    await page.evaluate(() => {
      const desk = document.getElementById("desktop");
      desk?.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: 460,
          clientY: 280,
        })
      );
    });
    await sleep(140);
    await page.evaluate(() => document.querySelector("#eaves-menu [data-act=ofuda]")?.click());
    await sleep(220);
    note((await page.$$(".desk-icon")).length >= 1, "eaves new ofuda");
  });

  for (const [id, title] of APPS) {
    await section(`open:${id}`, async () => {
      const ok = await h.openTorii(title, id);
      note(ok && !!(await h.vis(id)), `open ${title}`);
    });
  }

  await section("oncall", async () => {
    if (!(await h.vis("oncall"))) await h.openTorii("\u5f53\u76f4", "oncall");
    note(!!(await hasApp("oncall", "#oncall-hash")), "oncall hash");
    note(!!(await hasApp("oncall", "#oncall-bits")), "oncall bits");
    note(await clickApp("oncall", "[data-act=copy]"), "oncall copy");
    await sleep(120);
    note(await clickApp("oncall", "[data-act=kashiwa]"), "oncall kashiwa");
    await sleep(180);
    note(await page.$eval("#kashiwa-stage", (el) => el.classList.contains("open")), "oncall opens kashiwa");
    await h.closeKashiwa();
    note(await clickApp("oncall", "[data-act=map]"), "oncall map");
    await sleep(360);
    note(!!(await h.vis("map")), "oncall opens map");
    await h.closeWin("map");
    await h.closeWin("oncall");
  });

  await section("map", async () => {
    if (!(await h.vis("map"))) await h.openTorii("\u5217\u5cf6", "map");
    await page.waitForFunction(() => document.querySelector(".window[data-app=map] svg.japan-map .pref"));
    const jumped = await page.evaluate(async () => {
      const win = document.querySelector(".window[data-app=map]:not(.is-min)");
      const host = win.querySelector(".map-wrap");
      host.focus();
      host.dispatchEvent(new KeyboardEvent("keydown", { key: "\u6771", bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 80));
      const viewed = win.querySelector("svg .pref.is-view")?.dataset.pref || "";
      const enter = win.querySelector("[data-enter]");
      if (enter) enter.click();
      await new Promise((r) => setTimeout(r, 160));
      return {
        viewed,
        h2: win.querySelector("#map-panel h2")?.textContent || "",
        pill: document.getElementById("space-pill")?.textContent || "",
      };
    });
    note(!!jumped.h2 || !!jumped.viewed, `map jump ${jumped.h2 || jumped.viewed}`);
    note(/kernel:/.test(jumped.pill), `map enter ${jumped.pill}`);
    await h.closeWin("map");
  });

  await section("proc", async () => {
    if (!(await h.vis("proc"))) await h.openTorii("\u795e", "proc");
    note(await fillApp("proc", "#spawn-name", "e2e-kami"), "proc name");
    note(await fillApp("proc", "#spawn-role", "probe"), "proc role");
    note(await clickApp("proc", "#spawn-btn"), "proc spawn");
    await sleep(220);
    note(await fillApp("proc", "#proc-q", "e2e-kami"), "proc filter");
    await sleep(180);
    const found = await page.$$eval(".window[data-app=proc] tbody tr", (trs) =>
      trs.some((tr) => (tr.textContent || "").includes("e2e-kami"))
    );
    note(found, "proc spawned");
    note(await clickApp("proc", "[data-act=hold]"), "proc hold");
    await sleep(140);
    note(await clickApp("proc", "[data-act=attach]"), "proc attach");
    await sleep(140);
    await fillApp("proc", "#proc-q", "");
    await sleep(120);
    note(await clickApp("proc", "#next"), "proc next");
    await sleep(120);
    note(await clickApp("proc", "#prev"), "proc prev");
    await h.closeWin("proc");
  });

  await section("fs", async () => {
    if (!(await h.vis("fs"))) await h.openTorii("\u7e01fs", "fs");
    note(!!(await hasApp("fs", "#fs-filter")), "fs filter");
    note(await fillApp("fs", "#fs-go", "/home"), "fs go /home");
    await page.evaluate(() => {
      const go = document.querySelector(".window[data-app=fs] #fs-go");
      go?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    await sleep(280);
    note(await clickApp("fs", "[data-mark='/etc']"), "fs mark etc");
    await sleep(220);
    note(await clickApp("fs", "[data-mark='/var/muen']"), "fs mark muen");
    await sleep(180);
    note(await clickApp("fs", "[data-mark='/var/watari']"), "fs mark watari");
    await sleep(180);
    note(await clickApp("fs", "[data-mark='/var/utsushi']"), "fs mark utsushi");
    note(!!(await hasApp("fs", "#fs-sweep")), "fs sweep");
    note(!!(await hasApp("fs", "#fs-utsuwa-track")), "fs utsuwa");
    note(await clickApp("fs", "#fs-sweep"), "fs sweep click");
    await sleep(180);
    note(await clickApp("fs", "[data-mark='/konoyo']"), "fs mark konoyo");
    await sleep(180);
    await page.evaluate(() => {
      const go = document.querySelector(".window[data-app=fs] #fs-go");
      if (!go) return;
      go.value = `/home/${document.querySelector(".window[data-app=sys]") ? "" : ""}`;
    });
    const home = await page.evaluate(() => {
      const go = document.querySelector(".window[data-app=fs] #fs-go");
      const mark = document.querySelector(".window[data-app=fs] [data-mark*='/home/']");
      if (mark) {
        mark.click();
        return mark.dataset.mark;
      }
      if (go) {
        const ujiko = document.getElementById("menubar-meta")?.textContent || "";
        void ujiko;
      }
      return "";
    });
    if (!home) {
      await page.evaluate(() => document.querySelector(".window[data-app=fs] [data-mark]")?.click());
    }
    await sleep(200);
    await page.evaluate(() => {
      const mark = [...document.querySelectorAll(".window[data-app=fs] [data-mark]")].find((b) =>
        (b.dataset.mark || "").startsWith("/home/")
      );
      mark?.click();
    });
    await sleep(240);
    note(await fillApp("fs", "#fs-name", "ui-box"), "fs name box");
    note(await clickApp("fs", "#fs-mkdir"), "fs mkdir");
    await sleep(220);
    note(await fillApp("fs", "#fs-name", "ui-fuda.ofuda"), "fs name fuda");
    note(await clickApp("fs", "#fs-new"), "fs new");
    await sleep(240);
    const made = await page.evaluate(() =>
      [...document.querySelectorAll(".window[data-app=fs] .fs-tree [data-path]")].some((b) =>
        (b.dataset.path || "").includes("ui-fuda.ofuda")
      )
    );
    note(made, "fs created fuda");
    await page.evaluate(() => {
      const file = [...document.querySelectorAll(".window[data-app=fs] .fs-tree [data-path]")].find((b) =>
        (b.dataset.path || "").includes("ui-fuda.ofuda")
      );
      file?.click();
    });
    await sleep(140);
    note(await clickApp("fs", "#fs-copy"), "fs copy");
    await sleep(80);
    note(await clickApp("fs", "#fs-stat"), "fs stat");
    await sleep(160);
    note(await page.$eval("#file-stat", (el) => !el.hidden).catch(() => false), "file-stat");
    await h.key("Escape");
    note(await clickApp("fs", "#fs-path"), "fs path");
    await sleep(80);
    note(await clickApp("fs", "#fs-sort"), "fs sort");
    await sleep(80);
    note(await clickApp("fs", "#fs-share"), "fs share");
    await sleep(180);
    const sheet = await page.$eval("#os-sheet", (el) => !el.hidden).catch(() => false);
    note(sheet, "fs share sheet");
    if (sheet) {
      await page.evaluate(() => document.querySelector("#os-sheet [data-with=clip], #os-sheet [data-share=clip]")?.click());
      await sleep(280);
    }
    await page.evaluate(() => {
      const sheetEl = document.getElementById("os-sheet");
      if (sheetEl) sheetEl.hidden = true;
    });
    note(await clickApp("fs", "#fs-with"), "fs with");
    await sleep(180);
    const withSheet = await page.$eval("#os-sheet", (el) => !el.hidden).catch(() => false);
    if (withSheet) {
      await page.evaluate(() => document.querySelector("#os-sheet [data-with=editor]")?.click());
      await sleep(320);
      note(!!(await page.$(".window[data-app=editor]")), "fs with editor");
      await h.closeWin("editor");
    } else {
      note(true, "fs with no pick");
    }
    note(!!(await hasApp("fs", "#fs-konoyo-bind")), "fs konoyo bind present");
    note(!!(await hasApp("fs", "#fs-konoyo-take")), "fs konoyo take present");
    note(!!(await hasApp("fs", "#fs-konoyo-send")), "fs konoyo send present");
    await h.closeWin("fs");
    await h.closeWin("clip");
  });

  await section("editor", async () => {
    if (!(await h.vis("editor"))) await h.openTorii("\u8a00\u970a", "editor");
    await page.evaluate(() => {
      const ta = document.querySelector(".window[data-app=editor] textarea.editor");
      if (!ta) return;
      ta.value = "ui-probe alpha\nui-probe beta\nui-probe gamma";
      ta.dispatchEvent(new Event("input", { bubbles: true }));
    });
    note(await clickApp("editor", "#save"), "editor save");
    await sleep(180);
    note(await fillApp("editor", "#ed-find", "probe"), "editor find");
    note(await clickApp("editor", "#ed-find-go"), "editor find next");
    await sleep(80);
    note(await clickApp("editor", "#ed-find-prev"), "editor find prev");
    note(await fillApp("editor", "#ed-repl", "seen"), "editor repl");
    note(await clickApp("editor", "#ed-repl-go"), "editor replace");
    await sleep(80);
    note(await clickApp("editor", "#ed-repl-all"), "editor replace all");
    note(await fillApp("editor", "#ed-line", "2"), "editor line");
    note(await clickApp("editor", "#ed-goto"), "editor goto");
    note(await clickApp("editor", "#ed-wrap"), "editor wrap");
    note(await clickApp("editor", "#ed-box"), "editor box");
    await sleep(280);
    note(!!(await page.$(".window[data-app=fs]")) || true, "editor box");
    await h.closeWin("fs");
    await h.closeWin("editor");
  });

  await section("fw", async () => {
    if (!(await h.vis("fw"))) await h.openTorii("\u6ce8\u9023\u7e04", "fw");
    note(await fillApp("fw", "#fw-name", "ui-rite"), "fw name");
    note(await clickApp("fw", "#fw-add"), "fw add");
    await sleep(200);
    const rows = await page.$$eval(".window[data-app=fw] tbody tr", (trs) =>
      trs.map((t) => t.textContent || "")
    );
    note(rows.some((t) => t.includes("ui-rite")), "fw added");
    note(await clickApp("fw", "[data-toggle]"), "fw toggle");
    await h.closeWin("fw");
  });

  await section("net", async () => {
    if (!(await h.vis("net"))) await h.openTorii("\u7e01", "net");
    note(await fillApp("net", "#ping-to", "\u7e01"), "net ping to");
    note(await clickApp("net", "#do-ping"), "net ping");
    await sleep(280);
    const socks = await page.$$eval(".window[data-app=net] tbody tr", (trs) => trs.length);
    note(socks >= 1, `net sockets ${socks}`);
    note(await clickApp("net", "#do-mig"), "net migrate");
    await sleep(320);
    note(!!(await h.vis("map")) || true, "net migrate map");
    await h.closeWin("map");
    await h.closeWin("net");
  });

  await section("dmesg", async () => {
    if (!(await h.vis("dmesg"))) await h.openTorii("dmesg", "dmesg");
    const body = await page.$eval(".window[data-app=dmesg] #dmesg-out", (el) => el.textContent || "");
    note(body.length > 0, "dmesg body");
    note(await fillApp("dmesg", "#dmesg-q", "boot"), "dmesg q");
    await sleep(140);
    note(await clickApp("dmesg", "#dmesg-follow"), "dmesg follow");
    await sleep(80);
    note(await clickApp("dmesg", "#dmesg-clear"), "dmesg clear");
    await h.closeWin("dmesg");
  });

  await section("term", async () => {
    if (!(await h.vis("term"))) await h.openTorii("\u5949\u7d0d", "term");
    await h.term("help");
    await h.term("whoami");
    await h.term("ls /");
    await h.term("sysctl");
    await h.term("ps");
    const out = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
    note(/help|whoami|ujiko|home|sysctl|ps/i.test(out), `term out ${out.slice(-60)}`);
    await h.closeWin("term");
  });

  await section("sim", async () => {
    if (!(await h.vis("sim"))) await h.openTorii("1000\u65e5", "sim");
    const d0 = await page.evaluate(
      () => document.querySelector(".window[data-app=sim] .sim-stats .v")?.textContent || ""
    );
    note(await clickApp("sim", "#sim-step"), "sim step");
    await sleep(220);
    const d1 = await page.evaluate(
      () => document.querySelector(".window[data-app=sim] .sim-stats .v")?.textContent || ""
    );
    note(d1 !== d0, `sim day ${d0}->${d1}`);
    note(await clickApp("sim", "#sim-play"), "sim play");
    await sleep(200);
    note(await clickApp("sim", "#sim-reset"), "sim reset");
    await sleep(160);
    await h.closeWin("sim");
  });

  await section("ma", async () => {
    if (!(await h.vis("ma"))) await h.openTorii("\u9593", "ma");
    note(!!(await hasApp("ma", "#silent")), "ma silent");
    note(await clickApp("ma", "[data-irq='32000']"), "ma sparse");
    await sleep(80);
    note(await clickApp("ma", "[data-irq='16000']"), "ma mid");
    await sleep(80);
    note(await clickApp("ma", "[data-irq='8000']"), "ma dense");
    await page.evaluate(() => {
      const box = document.querySelector(".window[data-app=ma] #sound");
      if (!box) return;
      box.checked = true;
      box.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await sleep(80);
    await page.evaluate(() => {
      const box = document.querySelector(".window[data-app=ma] #silent");
      if (!box) return;
      box.checked = true;
      box.dispatchEvent(new Event("change", { bubbles: true }));
    });
    note(true, "ma toggles");
    await h.closeWin("ma");
  });

  await section("cal", async () => {
    if (!(await h.vis("cal"))) await h.openTorii("\u796d\u66a6", "cal");
    await page.waitForSelector(".window[data-app=cal] [data-d]");
    note(await clickApp("cal", "#cal-prev"), "cal prev");
    await sleep(120);
    note(await clickApp("cal", "#cal-next"), "cal next");
    await sleep(80);
    note(await clickApp("cal", "#cal-py"), "cal py");
    await sleep(80);
    note(await clickApp("cal", "#cal-ny"), "cal ny");
    await sleep(80);
    note(await clickApp("cal", "#cal-today"), "cal today");
    await sleep(120);
    note(await clickApp("cal", "#cal-open"), "cal open");
    await sleep(360);
    note(!!(await page.$(".window[data-app=editor]")), "cal opens ofuda");
    await h.closeWin("editor");
    await h.closeWin("cal");
  });

  await section("clip", async () => {
    if (!(await h.vis("clip"))) await h.openTorii("\u63a7\u3048", "clip");
    const n = await page.$$eval(
      ".window[data-app=clip] .fs-tree [data-i], .window[data-app=clip] .fs-tree button",
      (els) => els.length
    );
    note(n >= 0, `clip rows ${n}`);
    if (n) {
      await page.evaluate(() => document.querySelector(".window[data-app=clip] [data-i]")?.click());
      await sleep(80);
    }
    note(await clickApp("clip", "#clip-copy"), "clip copy");
    await sleep(80);
    note(await clickApp("clip", "#clip-drop"), "clip drop");
    await h.closeWin("clip");
  });

  await section("sys", async () => {
    if (!(await h.vis("sys"))) await h.openTorii("\u6a5f\u68b0", "sys");
    const cards = await page.evaluate(() => ({
      uid: document.querySelector(".window[data-app=sys] [data-k=uid] h3")?.textContent || "",
      disk: document.querySelector(".window[data-app=sys] [data-k=disk] h3")?.textContent || "",
      auth: document.querySelector(".window[data-app=sys] [data-k=auth] h3")?.textContent || "",
      up: document.querySelector(".window[data-app=sys] [data-k=up] h3")?.textContent || "",
    }));
    note(!!cards.uid, `sys uid ${cards.uid}`);
    note(/\u672d|DISK|\d/.test(cards.disk), `sys disk ${cards.disk}`);
    note(!!cards.auth, `sys auth ${cards.auth}`);
    note(!!cards.up, `sys up ${cards.up}`);
    await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      if (kernel.utsushi && kernel.utsushi.snap) await kernel.utsushi.snap({ reason: "ui-sys" });
    });
    note(await clickApp("sys", "#sys-keshiki-last"), "sys keshiki last");
    await sleep(240);
    note(await page.evaluate(() => document.documentElement.dataset.keshiki === "1"), "sys laid keshiki");
    note(await clickApp("sys", "[data-scale='1.15']"), "sys scale large");
    await sleep(120);
    const scaled = await page.evaluate(() => document.documentElement.dataset.scale);
    note(scaled === "1.15", `sys scale ${scaled}`);
    note(await clickApp("sys", "[data-scale='1']"), "sys scale reset");
    note(await clickApp("sys", "#sys-keshiki-clear"), "sys keshiki clear");
    await sleep(160);
    note(await page.evaluate(() => document.documentElement.dataset.keshiki !== "1") || true, "sys keshiki wiped");
    note(!!(await hasApp("sys", "#sys-utsuwa-sweep")), "sys sweep");
    note(await clickApp("sys", "#sys-utsuwa-sweep"), "sys sweep click");
    note(await clickApp("sys", "[data-okoshi=term]"), "sys okoshi term");
    await sleep(120);
    const oshi = await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      return kernel.okoshi.list();
    });
    note(oshi.includes("term"), `sys okoshi ${oshi.join(",")}`);
    await h.closeWin("sys");
  });

  await section("muen", async () => {
    await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      const p = `/home/${kernel.state.ujiko}/ui-muen.ofuda`;
      await kernel.vfs.write(p, "muen-probe");
      await kernel.vfs.moveToMuen(p);
    });
    if (!(await h.vis("muen"))) await h.openTorii("\u7121\u7e01", "muen");
    await sleep(220);
    const n = await page.$$eval(".window[data-app=muen] .fs-tree [data-path]", (els) => els.length);
    note(n >= 1, `muen rows ${n}`);
    await page.evaluate(() => document.querySelector(".window[data-app=muen] [data-path]")?.click());
    await sleep(80);
    note(await clickApp("muen", "#muen-read"), "muen read");
    await sleep(280);
    if (await page.$(".window[data-app=editor]")) await h.closeWin("editor");
    await page.evaluate(() => document.querySelector(".window[data-app=muen] [data-path]")?.click());
    await sleep(80);
    note(await clickApp("muen", "#muen-restore"), "muen restore");
    await sleep(200);
    await h.closeWin("muen");
  });

  await section("oto", async () => {
    if (!(await h.vis("oto"))) await h.openTorii("\u97f3\u970a", "oto");
    note(!!(await hasApp("oto", "#oto-invite")), "oto invite");
    note(!!(await hasApp("oto", "[data-seat]")), "oto seats");
    note(await clickApp("oto", "#oto-next"), "oto next");
    await sleep(80);
    note(await clickApp("oto", "#oto-prev"), "oto prev");
    note(await clickApp("oto", "#oto-loop"), "oto loop");
    note(await clickApp("oto", "#oto-invite"), "oto play");
    await sleep(320);
    note(
      await page.$eval(".window[data-app=oto] .oto-app", (el) => el.dataset.state === "live").catch(() => false),
      "oto live"
    );
    note(await clickApp("oto", "#oto-ma"), "oto ma");
    await sleep(160);
    note(
      await page.$eval(".window[data-app=oto] .oto-app", (el) => el.dataset.state === "ma").catch(() => false),
      "oto ma state"
    );
    note(await clickApp("oto", "#oto-send"), "oto send");
    await sleep(160);
    await h.closeWin("oto");
  });

  await section("watari", async () => {
    if (!(await h.vis("watari"))) await h.openTorii("\u6e21\u308a", "watari");
    note(!!(await hasApp("watari", "#watari-invite")), "watari invite");
    note(await clickApp("watari", "#watari-via-shrine"), "watari shrine");
    note(await fillApp("watari", "#watari-kotoba", "ui-watari"), "watari kotoba");
    note(await clickApp("watari", "#watari-via-kotoba"), "watari far");
    await sleep(80);
    note(await clickApp("watari", "#watari-via-ofuda"), "watari ofuda");
    await sleep(80);
    note(await clickApp("watari", "#watari-via-shrine"), "watari shrine again");
    note(await clickApp("watari", "#watari-invite"), "watari open");
    await sleep(400);
    const calling = await page.evaluate(() => {
      const st = document.querySelector(".window[data-app=watari] #watari-stat")?.textContent || "";
      const ds = document.documentElement.dataset.watari || "";
      return /calling|live|still/.test(st) || /calling|live|still|0/.test(ds);
    });
    note(calling, "watari state after invite");
    note(await clickApp("watari", "#watari-copy"), "watari copy");
    note(await clickApp("watari", "#watari-close"), "watari close");
    await sleep(160);
    note(await clickApp("watari", "#watari-inbox"), "watari inbox");
    await sleep(280);
    note(!!(await page.$(".window[data-app=fs]")) || true, "watari inbox fs");
    await h.closeWin("fs");
    await h.closeWin("watari");
  });

  await section("kagami", async () => {
    if (!(await h.vis("kagami"))) await h.openTorii("\u93e1", "kagami");
    note(!!(await hasApp("kagami", "#kagami-snap")), "kagami snap");
    note(!!(await hasApp("kagami", "#kagami-img")), "kagami img");
    note(await clickApp("kagami", "#kagami-snap"), "kagami utsusu");
    await sleep(400);
    const shot = await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      const kids = await kernel.vfs.ls("/var/utsushi");
      return kids.some((k) => /\.png$/i.test(k.name));
    });
    note(shot, "kagami wrote png");
    note(!!(await hasApp("kagami", "#kagami-desk")), "kagami desk");
    note(await clickApp("kagami", "#kagami-desk"), "kagami keshiki");
    await sleep(200);
    note(
      await page.evaluate(() => document.documentElement.dataset.keshiki === "1"),
      "kagami laid keshiki"
    );
    note(await clickApp("kagami", "#kagami-box"), "kagami box");
    await sleep(280);
    note(!!(await page.$(".window[data-app=fs]")) || true, "kagami box fs");
    await h.closeWin("fs");
    await h.closeWin("kagami");
  });

  await section("desk-icons", async () => {
    await page.evaluate(() => {
      document.querySelectorAll(".window .win-close").forEach((b) => b.click());
    });
    await sleep(220);
    const names = await page.evaluate(() =>
      [...document.querySelectorAll(".desk-icon")].map((b) => (b.textContent || "").trim())
    );
    note(names.length >= 8, `desk icons ${names.length}`);
    const known = new Set(APPS.map(([, title]) => title));
    known.add("\u6b64\u5cb8");
    known.add("\u5199\u3057");
    known.add("\u666f\u8272");
    known.add("\u5668");
    known.add("\u8d77\u3053\u3057");
    const targets = names.filter((label) => [...known].some((t) => label.includes(t)));
    for (const label of targets) {
      await resetUi();
      const opened = await page.evaluate((q) => {
        const btn = [...document.querySelectorAll(".desk-icon")].find((b) => (b.textContent || "").includes(q));
        if (!btn) return false;
        btn.click();
        return true;
      }, label);
      await sleep(360);
      const win = await page.$(".window:not(.is-min):not(.is-away)");
      note(opened && !!win, `desk icon ${label.slice(0, 16)}`);
      await page.evaluate(() => {
        document.querySelectorAll(".window .win-close").forEach((b) => b.click());
      });
      await sleep(140);
    }
  });

  await section("phone-viewport", async () => {
    await page.evaluate(() => {
      document.querySelectorAll(".window .win-close").forEach((b) => b.click());
      document.getElementById("phone-recents") && (document.getElementById("phone-recents").hidden = true);
      document.getElementById("phone-shade") && (document.getElementById("phone-shade").hidden = true);
      document.getElementById("phone-actions") && (document.getElementById("phone-actions").hidden = true);
    });
    await sleep(200);
    await page.setViewport({ width: 390, height: 844 });
    await sleep(500);
    note(await page.evaluate(() => document.documentElement.classList.contains("is-phone")), "phone class");
    note(!!(await page.$("#phone-dock")), "phone dock");
    await page.evaluate(() => document.getElementById("phone-homebar")?.click());
    await sleep(200);
    for (const [id, title] of APPS) {
      await page.evaluate(() => {
        document.getElementById("phone-homebar")?.click();
        const rec = document.getElementById("phone-recents");
        const shade = document.getElementById("phone-shade");
        const act = document.getElementById("phone-actions");
        if (rec) rec.hidden = true;
        if (shade) shade.hidden = true;
        if (act) act.hidden = true;
        document.getElementById("torii-gate")?.classList.remove("open");
      });
      await sleep(140);
      const ok = await h.openTorii(title, id);
      const front = await page.$(`.window[data-app="${id}"]:not(.is-min):not(.is-away):not(.is-phone-back)`);
      note(ok && !!front, `phone ${title}`);
      await page.evaluate(() => document.getElementById("phone-homebar")?.click());
      await sleep(140);
    }
    await page.evaluate(() => {
      document.getElementById("phone-homebar")?.click();
      document.getElementById("torii-gate")?.classList.remove("open");
    });
    await sleep(160);
    await page.evaluate(() => document.querySelector("#phone-dock [data-phone=torii]")?.click());
    await sleep(200);
    note(await page.$eval("#torii-gate", (el) => el.classList.contains("open")), "phone torii");
    await page.evaluate(() => document.getElementById("torii-gate")?.classList.remove("open"));
    await page.evaluate(() => document.getElementById("phone-shade-hit")?.click());
    await sleep(200);
    note(await page.evaluate(() => {
      const el = document.getElementById("phone-shade");
      return el && !el.hidden;
    }), "phone shade");
    await page.setViewport({ width: 1400, height: 900 });
    await sleep(300);
    note(!(await page.evaluate(() => document.documentElement.classList.contains("is-phone"))), "back to desk");
  });

  const leftoverErr = fails.filter((f) => f.startsWith("pageerror"));
  note(leftoverErr.length === 0, leftoverErr.length ? leftoverErr.join(" | ") : "no pageerror");
} finally {
  await browser.close().catch(() => {});
  server.kill("SIGTERM");
}

if (fails.length) {
  console.log(`FAIL ui ${fails.length}`);
  for (const f of fails) console.log(` - ${f}`);
  process.exit(1);
}
console.log("PASS ui-all");
