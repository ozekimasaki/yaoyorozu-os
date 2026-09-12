import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "/tmp/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";
import {
  ROOT,
  sleep,
  freePort,
  startStatic,
  waitHttp,
  makeNote,
  attachPage,
} from "./harness.mjs";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome-stable";
const { fails, note } = makeNote();

const port = Number(process.env.YAO_PORT) || (await freePort());
const base = `http://127.0.0.1:${port}/index.html`;
const server = startStatic(port);
await waitHttp(base);

const profile = mkdtempSync(join(tmpdir(), "yao-e2e-"));
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
    });
  }
}

try {
  await h.boot();
  note(!!(await page.$("#desktop.on")), "\u8d77\u52d5\u3057\u3066\u5353\u304c\u70b9\u304f");
  note(!!(await page.$("#desktop-icons .desk-icon")), "\u5353\u306b\u672d\u304c\u3042\u308b");
  const deskMarks = await page.evaluate(() =>
    [...document.querySelectorAll(".desk-icon .fuda-mark")].map((el) => el.dataset.icon || "")
  );
  note(deskMarks.length >= 8 && new Set(deskMarks).size === deskMarks.length, `\u672d\u30a2\u30a4\u30b3\u30f3\u56fa\u6709 ${deskMarks.join(",")}`);
  const deskFit = await page.evaluate(() => {
    const limit = window.innerHeight - 48;
    return [...document.querySelectorAll(".desk-icon")].every((el) => el.offsetTop + 36 < limit);
  });
  note(deskFit, "\u5353\u672d\u304c\u5353\u306b\u53ce\u307e\u308b");
  const hint = await page.$eval(".hint", (el) => el.textContent || "");
  note(hint.includes("/") && hint.includes(";"), `\u30d2\u30f3\u30c8 ${hint.slice(0, 40)}`);
  const pills = await page.evaluate(() => ({
    space: document.getElementById("space-pill")?.textContent || "",
    kami: document.getElementById("kami-pill")?.textContent || "",
    logout: document.getElementById("logout-pill")?.textContent || "",
    disk: document.getElementById("disk-pill")?.textContent || "",
    net: document.getElementById("net-pill")?.textContent || "",
  }));
  note(/kernel:/.test(pills.space), `\u7a7a\u9593pill ${pills.space}`);
  note(/kami:/.test(pills.kami), `\u795epill ${pills.kami}`);
  note(pills.logout.includes("\u9077\u5bae") || pills.logout.includes("logout"), `logout pill ${pills.logout}`);
  note(/\u7e01:/.test(pills.net) || /:/.test(pills.net), `\u7e01pill ${pills.net}`);

  const beforeUrl = page.url();
  await page.click("#logout-pill");
  await sleep(200);
  note(page.url() === beforeUrl && !!(await page.$("#desktop.on")), "\u30ed\u30b0\u30a2\u30a6\u30c8\u306f EPERM \u3067\u5353\u306b\u6b8b\u308b");

  await h.clap();
  const auth = await page.evaluate(() => document.getElementById("kashiwa-result")?.textContent || "");
  note(true, `\u67cf\u624b ${auth || "\u901a\u96fb"}`);

  await h.key("?");
  note(await page.$eval("#keymap", (el) => !el.hidden), "? \u3067\u64cd\u4f5c\u8868");
  await h.key("Escape");
  note(await page.$eval("#keymap", (el) => el.hidden), "Esc \u3067\u64cd\u4f5c\u8868\u3092\u9589\u3058\u308b");

  await h.key("n");
  note(await page.$eval("#oshi-list", (el) => !el.hidden), "n \u3067\u304a\u544a\u3052");
  await h.key("Escape");

  await h.key("'");
  note(await page.$eval("#space-switcher", (el) => el.classList.contains("open")), "' \u3067\u7a7a\u9593");
  note((await page.$$("#space-switcher [data-id]")).length >= 47, "47\u770c");
  await h.key("\u5ca1");
  const oka = await page.evaluate(() => document.querySelector("#space-switcher [data-id].is-on")?.dataset.id || "");
  note(oka === "okayama" || oka.includes("oka"), `\u982d\u6587\u5b57\u5ca1 ${oka}`);
  await h.key("Enter");
  note((await page.$eval("#space-pill", (el) => el.textContent || "")).includes("\u5ca1\u5c71"), "Enter \u3067\u5ca1\u5c71");
  await h.key("'");
  await h.key("Home");
  const homePref = await page.$eval("#space-switcher [data-id].is-on", (el) => el.dataset.name || "");
  note(!!homePref, `Home ${homePref}`);
  await h.key("PageDown");
  const pagePref = await page.$eval("#space-switcher [data-id].is-on", (el) => el.dataset.name || "");
  note(pagePref !== homePref, `PageDown ${homePref}->${pagePref}`);
  await h.key("Escape");
  await h.key("]");
  const afterBracket = await page.$eval("#space-pill", (el) => el.textContent || "");
  note(afterBracket.startsWith("kernel:"), `] \u96a3\u770c ${afterBracket}`);

  await page.click("#space-pill");
  await sleep(200);
  note(await page.$eval("#space-switcher", (el) => el.classList.contains("open")), "\u770cpill\u3067\u7a7a\u9593");
  await h.key("Escape");

  await h.openTorii("\u5f53\u76f4", "oncall");
  note(!!(await h.vis("oncall")), "\u5f53\u76f4");
  note(!!(await page.$(".window[data-app=oncall] #oncall-hash")), "\u5f53\u76f4\u30cf\u30c3\u30b7\u30e5");
  note(!!(await page.$(".window[data-app=oncall] #oncall-bits")), "\u5f53\u76f4\u30d3\u30c3\u30c8");
  await h.closeWin("oncall");

  await h.openTorii("\u5217\u5cf6", "map");
  note(!!(await h.vis("map")), "\u5217\u5cf6");
  await page.waitForFunction(() => document.querySelector(".window[data-app=map] svg.japan-map .pref"));
  const mapJump = await page.evaluate(async () => {
    const win = document.querySelector(".window[data-app=map]:not(.is-min)");
    const host = win.querySelector(".map-wrap");
    host.focus();
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "\u5ca1", bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 80));
    const viewed = win.querySelector("svg .pref.is-view")?.dataset.pref || "";
    const h2 = win.querySelector("#map-panel h2")?.textContent || "";
    host.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 180));
    return { viewed, h2, pill: document.getElementById("space-pill")?.textContent || "" };
  });
  note(mapJump.h2.includes("\u5ca1") || mapJump.viewed.includes("okayama"), `\u5217\u5cf6\u982d\u6587\u5b57 ${mapJump.h2} ${mapJump.viewed}`);
  note(mapJump.pill.includes("\u5ca1\u5c71"), `\u5217\u5cf6Enter ${mapJump.pill}`);
  await h.closeWin("map");
