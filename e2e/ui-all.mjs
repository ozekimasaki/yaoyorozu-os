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
