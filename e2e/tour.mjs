import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "/tmp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";
import { ROOT, sleep, freePort, startStatic, waitHttp, makeNote, attachPage } from "./harness.mjs";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome-stable";
const SHOTS = process.env.YAO_SHOTS || "/opt/cursor/artifacts/e2e-tour";
const { fails, note } = makeNote();

const port = Number(process.env.YAO_PORT) || (await freePort());
const base = `http://127.0.0.1:${port}/index.html`;
const server = startStatic(port);
await waitHttp(base);

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  userDataDir: mkdtempSync(join(tmpdir(), "yao-tour-")),
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1400,900"],
});
const page = await browser.newPage();
page._yaoUrl = base;
page.setDefaultTimeout(20000);
await page.setViewport({ width: 1400, height: 900 });
const h = attachPage(page, { fails, note, shots: SHOTS });

async function section(name, fn) {
  try {
    await h.closeKashiwa();
    await fn();
  } catch (err) {
    note(false, `${name}: ${err.message}`);
    await h.closeKashiwa();
    await page.evaluate(() => {
      document.getElementById("torii-gate")?.classList.remove("open");
      document.getElementById("win-switcher")?.classList.remove("open");
      document.getElementById("space-switcher")?.classList.remove("open");
      const km = document.getElementById("keymap");
      if (km) km.hidden = true;
    });
  }
}

try {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#boot-ready:not([hidden])");
  note(!!(await page.$("#boot-skip")), "boot ready");
  await h.shot("boot");

  await page.click("#boot-skip");
  await page.waitForSelector("#desktop.on");
  await sleep(700);
  await h.closeKashiwa();
  note(!!(await page.$("#desktop.on")), "desk on");
  await h.shot("desk");

  await page.click("#logout-pill");
  await sleep(200);
  note(!!(await page.$("#desktop.on")), "logout EPERM");

  await h.key("k");
  note(await page.$eval("#kashiwa-stage", (el) => el.classList.contains("open")), "kashiwa open");
  await h.shot("kashiwa");
  await h.tap("#kashiwa-stage [data-hand=left]");
  await sleep(80);
  await h.tap("#kashiwa-stage [data-hand=right]");
  await sleep(1600);
  await h.shot("kashiwa-done");
  await h.closeKashiwa();

  await h.key("?");
  note(await page.$eval("#keymap", (el) => !el.hidden), "keymap");
  await h.shot("keymap");
  await h.key("Escape");

  await h.key("'");
  note(await page.$eval("#space-switcher", (el) => el.classList.contains("open")), "spaces");
  await h.shot("spaces");
  await h.key("\u5ca1");
  await sleep(120);
  await h.key("Enter");
  await sleep(200);
  await h.shot("space-okayama");

  await page.click(".brand");
  await sleep(260);
  note(await page.$eval("#torii-gate", (el) => el.classList.contains("open")), "torii");
  await h.shot("torii");

  await section("oncall", async () => {
    await h.openTorii("\u5f53\u76f4", "oncall");
    note(!!(await h.vis("oncall")), "oncall");
    await h.shot("oncall");
  });

  await section("map", async () => {
    await h.openTorii("\u5217\u5cf6", "map");
    await page.waitForFunction(() => document.querySelector(".window[data-app=map] svg.japan-map .pref"));
    await h.shot("map");
    await page.evaluate(() => {
      const host = document.querySelector(".window[data-app=map]:not(.is-min) .map-wrap");
      host?.focus();
      host?.dispatchEvent(new KeyboardEvent("keydown", { key: "\u5ca1", bubbles: true, cancelable: true }));
    });
    await sleep(200);
    await h.shot("map-okayama");
    await h.closeWin("map");
  });

  await section("fs-term", async () => {
    await h.openTorii("\u7e01fs", "fs");
    note(!!(await h.vis("fs")), "fs");
    await h.shot("fs");
    await h.openTorii("\u5949\u7d0d", "term");
    await h.term("ls /etc");
    await h.term("whoami");
    note(!!(await h.vis("term")), "term");
    await h.shot("term");
  });

  await section("wins-expose", async () => {
    await h.openTorii("dmesg", "dmesg");
    await h.desk();
    await h.key(";");
    note(await page.$eval("#win-switcher", (el) => el.classList.contains("open")), "win switcher");
    await h.shot("wins");
    await h.key("Escape");
    await h.desk();
    await h.key("e");
    const exposed = await page.evaluate(
      () =>
        document.getElementById("window-layer")?.classList.contains("is-expose") ||
        document.getElementById("desktop")?.classList.contains("is-expose")
    );
    note(exposed, "expose");
    await h.shot("expose");
    await h.key("Escape");
  });

  await section("recent-cal", async () => {
    await h.desk();
    await h.key("r");
    note(await page.$eval("#recent-list", (el) => !el.hidden), "recent");
    await h.shot("recent");
    await h.key("Escape");
    await page.click("#clock");
    await h.awaitApp("cal");
    await page.waitForSelector(".window[data-app=cal] [data-d]");
    await h.shot("cal");
    await h.closeWin("cal");
  });

  await section("grep", async () => {
    await page.click(".brand");
    await sleep(220);
    await page.evaluate(() => {
      const box = document.querySelector("#torii-search");
      if (!box) return;
      box.value = "\u901a\u96fb";
      box.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await sleep(500);
    const body = await page.$$eval("#torii-list button", (els) => els.map((b) => b.textContent || "").join(" "));
    note(/grep|\u901a\u96fb|\u4e09\u76f8/.test(body), "torii grep");
    await h.shot("torii-grep");
    await h.key("Escape");
  });

  await section("ma", async () => {
    await h.desk();
    await h.key("m");
    await sleep(280);
    const maOpen = await page.$eval("#ma-lock", (el) => el.classList.contains("open"));
    note(maOpen || !!(await page.$("#desktop.is-ma")), "ma");
    await h.shot("ma");
    if (await page.$("#ma-wake")) {
      await h.tap("#ma-wake");
      await sleep(250);
    }
    await h.shot("desk-end");
  });

  const leftoverErr = fails.filter((f) => f.startsWith("pageerror"));
  note(leftoverErr.length === 0, leftoverErr.length ? leftoverErr.join(" | ") : "no pageerror");
} finally {
  await browser.close().catch(() => {});
  server.kill("SIGTERM");
}

if (fails.length) {
  console.log(`FAIL ${fails.length}`);
  for (const f of fails) console.log(` - ${f}`);
  process.exit(1);
}
console.log(`PASS tour ${SHOTS}`);
