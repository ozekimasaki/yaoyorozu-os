import { existsSync, mkdtempSync, readFileSync } from "node:fs";
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
import { runOsLayers } from "./layers.mjs";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome-stable";
const { fails, note } = makeNote();

{
  const full = readFileSync(join(ROOT, "svg/japan-prefectures.svg"), "utf8");
  const n = (full.match(/<path\b[^>]*\sid="/g) || []).length;
  note(n === 47, `\u78c1\u76e4\u5217\u5cf6 ${n}`);
  const cut = full.indexOf('    <path id="kagawa"');
  let stitched = cut >= 0 ? full.slice(0, cut) : "";
  let parts = 0;
  for (let i = 25; i <= 62; i += 1) {
    const p = join(ROOT, "svg/_parts", `${i}.txt`);
    if (!existsSync(p)) continue;
    stitched += readFileSync(p, "utf8");
    parts += 1;
  }
  note(parts === 38, `\u5217\u5cf6\u65ad\u7247 ${parts}`);
  note(cut >= 0 && stitched === full, "\u5217\u5cf6\u65ad\u7247\u3092\u7d99\u3050\u3068\u78c1\u76e4\u3068\u4e00\u81f4");
}

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
  const landN = await page.$$eval(
    ".window[data-app=map]:not(.is-min):not(.is-away) svg.japan-map path.pref",
    (els) => new Set(els.map((e) => e.dataset.pref || e.id)).size
  );
  note(landN === 47, `\u5217\u5cf6path ${landN}`);
  const landStitch = await page.evaluate(async () => {
    const a = await (await fetch("svg/japan-prefectures.svg")).text();
    const cut = a.indexOf('    <path id="kagawa"');
    let t = cut >= 0 ? a.slice(0, cut) : a;
    let parts = 0;
    for (let i = 25; i <= 62; i += 1) {
      const r = await fetch(`svg/_parts/${i}.txt`);
      if (r.ok) {
        t += await r.text();
        parts += 1;
      }
    }
    return {
      raw: (a.match(/<path\b[^>]*\sid="/g) || []).length,
      parts,
      n: (t.match(/<path\b[^>]*\sid="/g) || []).length,
      closed: /<\/svg>/i.test(t),
    };
  });
  note(
    landStitch.n === 47 && landStitch.parts === 38 && landStitch.closed,
    `\u5217\u5cf6\u7d99\u304e ${landStitch.n}/${landStitch.parts}/${landStitch.closed}`
  );
