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

