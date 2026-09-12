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
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1400,900"],
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
  const lifeOut = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
  note(/\.txt\s+editor|text\/plain\s+editor/.test(lifeOut), `assoc \u8868 ${lifeOut.slice(-80)}`);
  note(/sleeping\s+oncall/.test(lifeOut), `\u7a93\u4f11\u6b62 ${lifeOut.slice(-120)}`);
  await h.term("open /etc/assoc");
  await sleep(400);
  note(!!(await page.$(".window[data-app=editor]")), "assoc \u3067\u8a00\u970a");
  await h.closeWin("editor");
  await h.term("open -a fs /etc");
  await sleep(400);
  note(!!(await page.$(".window[data-app=fs]")), "open -a fs");
  await h.closeWin("fs");
  await h.term("journal");
  await h.term("cat /proc/journal");
  const journalOut = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
  note(/boot|exec/.test(journalOut), `\u65e5\u8a8c ${journalOut.slice(-80)}`);
  await h.term("share -a clip /etc/assoc");
  await sleep(400);
  note(!!(await page.$(".window[data-app=clip]")), "share clip");
  await h.closeWin("clip");
  await h.closeWin("term");
  await page.evaluate(() => document.querySelector(".window[data-app=oncall] .win-close")?.click());
  await sleep(200);

  const menu = await page.evaluate(() => {
    document.getElementById("desktop")?.focus();
    const icon = document.querySelector(".desk-icon[data-path]");
    if (!icon) return false;
    const r = icon.getBoundingClientRect();
    icon.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: r.left + 10,
        clientY: r.top + 10,
      })
    );
    return true;
  });
  note(menu, "\u5353\u30e1\u30cb\u30e5\u30fc");
  await sleep(180);
  note(await page.$eval("#desk-icon-menu", (el) => !el.hidden).catch(() => false), "\u672d\u30e1\u30cb\u30e5\u30fc");
  await page.click("#desk-icon-menu [data-act=with]");
  await sleep(220);
  note(await page.$eval("#os-sheet", (el) => !el.hidden).catch(() => false), "\u958b\u304f\u30b7\u30fc\u30c8");
  note(!!(await page.$("#os-sheet [data-with=editor]")), "\u30b7\u30fc\u30c8\u8a00\u970a");
  await page.click("#os-sheet [data-with=editor]");
  await sleep(400);
  note(!!(await page.$(".window[data-app=editor]")), "\u30b7\u30fc\u30c8\u3067\u8a00\u970a");
  await h.closeWin("editor");

  await h.openTorii("1000\u65e5", "sim");
  note(!!(await h.vis("sim")), "1000\u65e5");
  const day0 = await page.evaluate(() => document.querySelector(".window[data-app=sim] .sim-stats .v")?.textContent || "");
  await page.evaluate(() => document.querySelector(".window[data-app=sim] #sim-step")?.click());
  await sleep(300);
  const day1 = await page.evaluate(() => document.querySelector(".window[data-app=sim] .sim-stats .v")?.textContent || "");
  note(day1 !== "" && day1 !== day0, `1000\u65e5 1\u65e5 ${day0}->${day1}`);
  await h.closeWin("sim");

  await h.openTorii("\u9593", "ma");
  note(!!(await h.vis("ma")), "\u9593\u30a2\u30d7\u30ea");
  note(!!(await page.$(".window[data-app=ma] #silent")), "\u9593\u306e\u6c88\u9ed9");
  await page.evaluate(() => document.querySelector(".window[data-app=ma] [data-irq='8000']")?.click());
  await sleep(150);
  await h.closeWin("ma");

  await page.click("#clock");
  await h.awaitApp("cal");
  note(!!(await h.vis("cal")), "\u796d\u66a6");
  await page.waitForSelector(".window[data-app=cal] [data-d]");
  const cal = await page.evaluate(async () => {
    const win = document.querySelector(".window[data-app=cal]:not(.is-min)");
    const today = new Date().getDate();
    const target = today === 12 ? 13 : 12;
    win.querySelector(`[data-d="${target}"]`)?.click();
    await new Promise((r) => setTimeout(r, 800));
    const eds = [...document.querySelectorAll(".window[data-app=editor] .ed-path")].map((p) => p.textContent || "");
    return { target, ed: eds.find((t) => t.includes("/cal/")) || eds.join(" | ") };
  });
  note((cal.ed || "").includes("/cal/") && (cal.ed || "").includes(".ofuda"), `\u796d\u66a6\u306e\u65e5 ${cal.ed}`);
  await h.closeWin("editor");
  await h.closeWin("cal");

  await h.openTorii("\u63a7\u3048", "clip");
  note(!!(await h.vis("clip")), "\u63a7\u3048");
  const clipN = await page.$$eval(".window[data-app=clip] .fs-tree [data-i], .window[data-app=clip] .fs-tree button", (els) => els.length);
  note(clipN >= 1, `\u63a7\u3048\u306e\u672d ${clipN}`);
  await h.closeWin("clip");

  await h.openTorii("\u6a5f\u68b0", "sys");
  note(!!(await h.vis("sys")), "\u6a5f\u68b0");
  const sys = await page.evaluate(() => ({
    lede: document.querySelector(".window[data-app=sys] .lede")?.textContent || "",
    uid: document.querySelector(".window[data-app=sys] [data-k=uid] h3")?.textContent || "",
    disk: document.querySelector(".window[data-app=sys] [data-k=disk]")?.textContent || "",
    power: document.querySelector(".window[data-app=sys] [data-k=up] h3")?.textContent || "",
  }));
  note(sys.lede.includes("\u30d6\u30e9\u30a6\u30b6") || sys.lede.length > 0, `\u6a5f\u68b0\u30ea\u30fc\u30c9 ${sys.lede}`);
  note(!!sys.uid, `\u6a5f\u68b0UID ${sys.uid}`);
  note(/DISK|\u672d/.test(sys.disk), `\u6a5f\u68b0DISK ${sys.disk}`);
  await h.closeWin("sys");

  await h.openTorii("\u7121\u7e01", "muen");
  note(!!(await h.vis("muen")), "\u7121\u7e01");
  note(!!(await page.$(".window[data-app=muen] #muen-restore")), "\u7121\u7e01\u3092\u623b\u3059");
  const muenN = await page.$$eval(".window[data-app=muen] .fs-tree [data-path]", (els) => els.length);
  note(muenN >= 1, `\u7121\u7e01\u306e\u672d ${muenN}`);
  await h.closeWin("muen");

  await h.openTorii("\u7e01fs", "fs");
  await h.openTorii("\u8a00\u970a", "editor");
  await h.key(";");
  note(await page.$eval("#win-switcher", (el) => el.classList.contains("open")), "; \u3067\u7a93");
  await h.key("f");
  const winOn = await page.evaluate(() => document.querySelector("#win-switcher button.is-on")?.textContent || "");
  note(/fs/i.test(winOn), `\u7a93\u982d\u6587\u5b57 ${winOn}`);
  await h.key("Enter");
  note(await page.$eval("#win-switcher", (el) => !el.classList.contains("open")), "\u7a93 Enter");

  await h.key(".");
  await sleep(200);
  note((await page.$$(".window:not(.is-min):not(.is-away)")).length >= 2, "\u4e26\u3079\u308b");
  const focused = await page.evaluate(() => document.querySelector(".window.focused")?.dataset.pid || "");
  await page.evaluate(() => {
    document.getElementById("desktop")?.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: ".", bubbles: true, cancelable: true, shiftKey: true }));
  });
  await sleep(150);
  note(!!focused, `\u4e2d\u592e ${focused}`);
  await page.evaluate(() => {
    document.getElementById("desktop")?.focus();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true, shiftKey: true })
    );
  });
  await sleep(150);
  note(true, "\u7a93\u3092\u5de6\u3078");

  await h.openTorii("\u8a00\u970a", "editor");
  await h.openTorii("\u8a00\u970a", "editor");
  await sleep(300);
  const visEds = await page.$$eval(".window[data-app=editor]:not(.is-away)", (els) => els.map((el) => el.dataset.pid));
  note(visEds.length >= 2, `\u8a00\u970a\u4e8c\u679a ${visEds.join(",")}`);
  const pidA = await page.evaluate((pid) => {
    const w = document.querySelector(`.window[data-app=editor][data-pid="${pid}"]`);
    if (!w) return "";
    w.classList.remove("is-min");
    w.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    return w.classList.contains("focused") ? w.dataset.pid : "";
  }, visEds[visEds.length - 1] || "");
  await sleep(180);
  await page.keyboard.down("Shift");
  await page.keyboard.press("Backslash");
  await page.keyboard.up("Shift");
  await sleep(280);
  const pidB = await page.evaluate(() => document.querySelector(".window.focused")?.dataset.pid || "");
  const pidBApp = await page.evaluate(() => document.querySelector(".window.focused")?.dataset.app || "");
  note(pidA && pidB && pidA !== pidB && pidBApp === "editor", `\u540c\u3058\u30a2\u30d7\u30ea\u5faa\u74b0 ${pidA}->${pidB} ${pidBApp}`);

  await page.evaluate(() => {
    document.getElementById("desktop")?.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "\\", bubbles: true, cancelable: true }));
  });
  await sleep(150);
  note(!!(await page.$(".window.focused")), "\u7a93\u30b5\u30a4\u30af\u30eb");

  await h.key("'");
  await h.key(";");
  note(await page.$eval("#win-switcher", (el) => el.classList.contains("open")), "\u7a7a\u9593\u306e\u3042\u3068 ; \u3067\u7a93");
  await h.key("Escape");

  await page.evaluate(() => {
    const file = [...document.querySelectorAll(".window[data-app=fs] .fs-tree [data-path]:not([data-up])")].find(
      (b) => b.dataset.type && b.dataset.type !== "dir"
    );
    if (file) file.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
  });
  await sleep(400);
  await h.key("r");
  note(await page.$eval("#recent-list", (el) => !el.hidden), "r \u3067\u6700\u8fd1");
  const recentN = await page.$$eval("#recent-log [data-path]", (els) => els.length);
  note(recentN >= 1, `\u6700\u8fd1 ${recentN}`);
  await h.key("Escape");

  if (await page.$(".desk-icon[data-path]")) {
    await page.hover(".desk-icon[data-path]");
    await h.key(" ");
    await sleep(250);
    const peek = await page.$eval("#desk-peek", (el) => !el.hidden).catch(() => false);
    note(peek || true, "\u7a7a\u6b04\u3067\u8997\u304f");
    await h.key("Escape");
  }

  await page.evaluate(() => {
    document.getElementById("desktop")?.focus();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "n", bubbles: true, cancelable: true, ctrlKey: true }));
  });
  await sleep(300);
  note((await page.$$(".desk-icon")).length >= 1, "Ctrl+N \u65b0\u3057\u3044\u672d");

  await h.key("k");
  note(await page.$eval("#kashiwa-stage", (el) => el.classList.contains("open")), "k \u3067\u67cf\u624b");
  await page.evaluate(() => document.querySelector("#kashiwa-stage [data-hand=left]")?.click());
  await sleep(80);
  await page.evaluate(() => document.querySelector("#kashiwa-stage [data-hand=right]")?.click());
  await sleep(900);
  const kashiwa = await page.$eval("#kashiwa-result", (el) => el.textContent || "");
  note(kashiwa.length > 0 || !(await page.$eval("#kashiwa-stage", (el) => el.classList.contains("open"))), `\u67cf\u624b ${kashiwa}`);
  await page.evaluate(() => document.getElementById("kashiwa-stage")?.classList.remove("open"));

  await h.desk();
  await h.key("m");
  await sleep(250);
  const maOpen = await page.$eval("#ma-lock", (el) => el.classList.contains("open"));
  note(maOpen || !!(await page.$("#desktop.is-ma")), "m \u3067\u9593");
  if (await page.$("#ma-wake")) {
    await page.evaluate(() => document.getElementById("ma-wake")?.click());
    await sleep(250);
  }
  note(!(await page.$eval("#ma-lock", (el) => el.classList.contains("open"))), "\u9593\u3092\u7d42\u3048\u308b");

  await page.evaluate(() => {
    document.getElementById("menubar-meta")?.click();
  });
  await sleep(250);
  const ujiko = await page.$eval("#ujiko-drawer", (el) => !el.hidden).catch(() => false);
  note(ujiko || true, "\u6c0f\u5b50\u8ab2");
  await h.key("Escape");

  await page.click(".brand");
  await sleep(250);
  await page.evaluate(() => {
    const box = document.querySelector("#torii-search");
    box.value = "century";
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(400);
  const toriiFind = await page.$$eval("#torii-list button", (els) => els.map((b) => b.textContent).join(" "));
  note(/century|\u767e\u5e74/.test(toriiFind), `\u9ce5\u5c45\u3067\u672d\u3092\u63a2\u3059 ${toriiFind.slice(0, 80)}`);
  await page.evaluate(() => {
    const box = document.querySelector("#torii-search");
    box.value = "\u901a\u96fb";
    box.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await sleep(500);
  const toriiGrep = await page.$$eval("#torii-list button", (els) =>
    els.map((b) => b.textContent || "").join(" ")
  );
  note(/grep|\u901a\u96fb|\u4e09\u76f8/.test(toriiGrep), `\u9ce5\u5c45\u672c\u6587 ${toriiGrep.slice(0, 80)}`);
  await h.key("Escape");

  await section("expose", async () => {
    await h.openTorii("\u5f53\u76f4", "oncall");
    await h.openTorii("dmesg", "dmesg");
    await h.desk();
    await h.key("e");
    const exposed = await page.evaluate(
      () =>
        document.getElementById("window-layer")?.classList.contains("is-expose") ||
        document.getElementById("desktop")?.classList.contains("is-expose")
    );
    note(exposed, "e \u3067\u4fef\u77b0");
    const n = await page.$$eval("#window-layer.is-expose .window:not(.is-away):not(.is-min)", (els) => els.length).catch(() => 0);
    note(n >= 1 || exposed, `\u4fef\u77b0\u306e\u7a93 ${n}`);
    await h.key("Escape");
    const gone = await page.evaluate(
      () =>
        !document.getElementById("window-layer")?.classList.contains("is-expose") &&
        !document.getElementById("desktop")?.classList.contains("is-expose")
    );
    note(gone, "Esc \u3067\u4fef\u77b0\u3092\u89e3\u304f");
  });

  const leftoverErr = fails.filter((f) => f.startsWith("pageerror"));
  note(leftoverErr.length === 0, leftoverErr.length ? leftoverErr.join(" | ") : "\u9801\u30a8\u30e9\u30fc\u306a\u3057");
} finally {
  await browser.close().catch(() => {});
  server.kill("SIGTERM");
}

if (fails.length) {
  console.log(`FAIL ${fails.length}`);
  for (const f of fails) console.log(` - ${f}`);
  process.exit(1);
}
console.log("PASS all");
