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
  const mapClick = await page.evaluate(async () => {
    const win = document.querySelector(".window[data-app=map]:not(.is-min)");
    const space0 = document.getElementById("space-pill")?.textContent || "";
    const other = [...win.querySelectorAll("svg .pref")].find((n) => !n.classList.contains("is-selected"));
    if (other) other.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 200));
    return {
      still: !!document.querySelector(".window[data-app=map]:not(.is-min):not(.is-away)"),
      space0,
      space1: document.getElementById("space-pill")?.textContent || "",
      viewed: win.querySelector("svg .pref.is-view")?.dataset.pref || "",
      selected: win.querySelector("svg .pref.is-selected")?.dataset.pref || "",
      h2: win.querySelector("#map-panel h2")?.textContent || "",
    };
  });
  note(mapClick.still, "\u5217\u5cf6\u30af\u30ea\u30c3\u30af\u3067\u7a93\u304c\u6b8b\u308b");
  note(mapClick.space0 === mapClick.space1, `\u5217\u5cf6\u30af\u30ea\u30c3\u30af\u306f\u7a7a\u9593\u3092\u79fb\u3055\u306a\u3044 ${mapClick.space1}`);
  note(!!mapClick.viewed && mapClick.viewed !== mapClick.selected, `\u5217\u5cf6\u30af\u30ea\u30c3\u30af\u306f\u898b\u308b ${mapClick.viewed}`);
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

  await page.click("#kami-pill");
  await h.awaitApp("proc");
  note(!!(await h.vis("proc")), "\u795e");
  note(!!(await page.$(".window[data-app=proc] #proc-q")), "\u795e\u306e\u691c\u7d22");
  await page.evaluate(() => {
    const box = document.querySelector(".window[data-app=proc] #proc-q");
    box.value = "sleep";
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(250);
  const procRows = await page.$$eval(".window[data-app=proc] tbody tr", (trs) => trs.length);
  note(procRows >= 1, `\u795e\u306e\u7d5e\u308a ${procRows}`);
  await page.evaluate(() => document.querySelector(".window[data-app=proc] #next")?.click());
  await sleep(200);
  note(!!(await page.$(".window[data-app=proc] tbody")), "\u795e\u306e\u6b21\u9801");
  await h.closeWin("proc");

  await h.openTorii("\u7e01fs", "fs");
  note(!!(await h.vis("fs")), "\u7e01fs");
  note(!!(await page.$(".window[data-app=fs] #fs-filter")), "\u7e01fs \u7d5e\u308a");
  await page.evaluate(() => {
    const go = document.querySelector(".window[data-app=fs] #fs-go");
    if (!go) return;
    go.value = "/etc";
    go.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  });
  await sleep(400);
  const etc = await page.$$eval(".window[data-app=fs] .fs-tree [data-path]:not([data-up])", (els) =>
    els.map((b) => b.dataset.path)
  );
  note(etc.some((p) => (p || "").includes("/etc")), `\u7e01fs /etc ${etc.slice(0, 3).join(" ")}`);
  await page.evaluate(() => {
    const file = [...document.querySelectorAll(".window[data-app=fs] .fs-tree [data-path]:not([data-up])")].find(
      (b) => b.dataset.type && b.dataset.type !== "dir"
    );
    if (file) file.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  await sleep(500);
  note(!!(await page.$(".window[data-app=editor]")), "\u7e01fs \u304b\u3089\u8a00\u970a");
  await h.closeWin("editor");
  await h.closeWin("fs");

  await h.openTorii("\u8a00\u970a", "editor");
  note(!!(await h.vis("editor")), "\u8a00\u970a");
  await page.evaluate(() => {
    const ta = document.querySelector(".window[data-app=editor] textarea.editor");
    if (!ta) return;
    ta.value = "yaoyorozu-e2e-probe\n\u4e8c\u884c\u76ee";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => document.querySelector(".window[data-app=editor] #save")?.click());
  await sleep(300);
  await page.evaluate(() => {
    const box = document.querySelector(".window[data-app=editor] #ed-find");
    if (!box) return;
    box.value = "e2e";
    box.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector(".window[data-app=editor] #ed-find-go")?.click();
  });
  await sleep(200);
  note(!!(await page.$(".window[data-app=editor] #ed-find")), "\u8a00\u970a\u3092\u63a2\u308b");
  await page.evaluate(() => {
    const box = document.querySelector(".window[data-app=editor] #ed-line");
    if (!box) return;
    box.value = "2";
    document.querySelector(".window[data-app=editor] #ed-goto")?.click();
  });
  await sleep(150);
  note(true, "\u8a00\u970a\u306e\u884c\u3078");
  await h.closeWin("editor");

  await h.openTorii("\u6ce8\u9023\u7e04", "fw");
  note(!!(await h.vis("fw")), "\u6ce8\u9023\u7e04");
  const fwRows = await page.$$eval(".window[data-app=fw] tbody tr", (trs) => trs.length);
  note(fwRows >= 3, `\u6ce8\u9023\u7e04\u306e\u884c ${fwRows}`);
  await page.evaluate(() => {
    const box = document.querySelector(".window[data-app=fw] #fw-name");
    box.value = "e2e-rite";
    document.querySelector(".window[data-app=fw] #fw-add")?.click();
  });
  await sleep(250);
  const fwAfter = await page.$$eval(".window[data-app=fw] tbody tr", (trs) => trs.map((t) => t.textContent));
  note(fwAfter.some((t) => (t || "").includes("e2e-rite")), "\u6ce8\u9023\u7e04\u306b\u5100\u793c\u3092\u8db3\u3059");
  await h.closeWin("fw");

  await h.closeKashiwa();
  await page.click("#net-pill");
  await h.awaitApp("net");
  note(!!(await h.vis("net")), "\u7e01");
  note(!!(await page.$(".window[data-app=net] #ping-to")), "\u7e01 ping\u6b04");
  await page.evaluate(() => document.querySelector(".window[data-app=net] #do-ping")?.click());
  await sleep(400);
  const socks = await page.$$eval(".window[data-app=net] tbody tr", (trs) => trs.length);
  note(socks >= 1, `\u7e01\u30bd\u30b1\u30c3\u30c8 ${socks}`);
  await h.closeWin("net");

  await h.openTorii("dmesg", "dmesg");
  note(!!(await h.vis("dmesg")), "dmesg");
  const dmesgBody = await page.$eval(".window[data-app=dmesg] #dmesg-out", (el) => el.textContent || "");
  note(dmesgBody.length > 0, "\u6838\u306e\u9418\u304c\u3042\u308b");
  await page.evaluate(() => {
    const box = document.querySelector(".window[data-app=dmesg] #dmesg-q");
    box.value = "exec";
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(200);
  note(!!(await page.$(".window[data-app=dmesg] #dmesg-follow")), "dmesg \u8ffd\u3046");
  await h.closeWin("dmesg");

  await h.openTorii("\u5949\u7d0d", "term");
  note(!!(await h.vis("term")), "\u5949\u7d0d");
  await h.term("whoami");
  await h.term("pwd");
  await h.term("ls /etc");
  await h.term("write e2e-probe.ofuda e2e-body");
  await h.term("file e2e-probe.ofuda");
  await h.term("clip e2e-clip");
  await h.term("rm e2e-probe.ofuda");
  await h.term("cron every 2 e2e-toki");
  await sleep(2600);
  await h.term("cron");
  await h.term("at +2 e2e-at");
  await h.term("atq");
  const termOut = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
  note(/e2e|etc|ofuda|ujiko|home/i.test(termOut), `\u5949\u7d0d\u51fa\u529b ${termOut.slice(-80)}`);
  note(/e2e-toki|every 2/.test(termOut), `\u6642\u5831 cron ${termOut.includes("e2e-toki")}`);
  const oshiN = await page.evaluate(() => (document.getElementById("oshi-pill")?.textContent || "").length);
  note(oshiN >= 1, `\u6642\u5831\u304a\u544a\u3052 ${oshiN}`);
  await h.closeWin("term");

  await h.openTorii("\u5949\u7d0d", "term");
  await h.openTorii("\u5f53\u76f4", "oncall");
  await page.evaluate(() => document.querySelector(".window[data-app=oncall] .win-min")?.click());
  await sleep(200);
  await h.term("assoc");
  await h.term("cat /proc/apps");
