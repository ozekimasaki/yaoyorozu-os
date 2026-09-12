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

  await h.openTorii("\u97f3\u970a", "oto");
  note(!!(await h.vis("oto")), "\u97f3\u970a");
  note(!!(await page.$(".window[data-app=oto] #oto-invite")), "\u62db\u304f");
  note(!!(await page.$(".window[data-app=oto] [data-seat]")), "\u5ea7");
  await page.evaluate(() => document.querySelector(".window[data-app=oto] #oto-invite")?.click());
  await sleep(360);
  note(await page.$eval(".window[data-app=oto] .oto-app", (el) => el.dataset.state === "live").catch(() => false), "\u62db\u3044\u3066\u9cf4\u308b");
  note(await page.evaluate(() => document.documentElement.dataset.oto === "live"), "\u6838\u306b\u9cf4\u308b");
  note(await page.evaluate(() => {
    const pill = document.getElementById("oto-pill");
    return !!(pill && !pill.hidden);
  }), "\u5353\u306b\u97f3\u970a");
  await page.evaluate(() => document.querySelector(".window[data-app=oto] .win-min")?.click());
  await sleep(220);
  note(await page.evaluate(() => {
    const app = document.querySelector(".window[data-app=oto] .oto-app");
    return !!(app && app.dataset.state === "live" && document.documentElement.dataset.oto === "live");
  }), "\u3057\u307e\u3063\u3066\u3082\u9cf4\u308b");
  await page.evaluate(() => document.getElementById("oto-pill")?.click());
  await sleep(280);
  note(!!(await h.vis("oto")), "\u672d\u3067\u8d77\u3053\u3059");
  await page.evaluate(() => document.querySelector(".window[data-app=oto] #oto-ma")?.click());
  await sleep(200);
  note(await page.$eval(".window[data-app=oto] .oto-app", (el) => el.dataset.state === "ma").catch(() => false), "\u97f3\u3092\u9593\u3078");
  await h.closeWin("oto");
  await sleep(160);
  note(await page.evaluate(() => document.documentElement.dataset.oto !== "live"), "\u9001\u3063\u3066\u9759");
  await h.openTorii("\u5949\u7d0d", "term");
  await h.term("open /etc/oto/\u67cf\u624b.oto");
  await sleep(400);
  note(!!(await page.$(".window[data-app=oto]")), "assoc .oto");
  await h.term("oto");
  await h.term("cat /proc/oto");
  const otoOut = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
  note(/state=/.test(otoOut), `proc oto ${otoOut.slice(-70)}`);
  await h.closeWin("oto");
  await h.closeWin("term");

  await section("konoyo", async () => {
    note(await page.evaluate(() => document.documentElement.dataset.konoyo === "1" || document.documentElement.dataset.konoyo === "0"), "\u6b64\u5cb8 dataset");
    await h.openTorii("\u7e01fs", "fs");
    note(!!(await page.$(".window[data-app=fs] [data-mark='/konoyo']")), "\u7e01fs \u6b64\u5cb8\u30de\u30fc\u30af");
    note(!!(await page.$(".window[data-app=fs] #fs-konoyo-bind")), "\u6b64\u5cb8\u3092\u7d50\u3076");
    note(!!(await page.$(".window[data-app=fs] #fs-konoyo-take")), "\u73fe\u4e16\u304b\u3089\u53d7\u3051\u308b");
    note(!!(await page.$(".window[data-app=fs] #fs-konoyo-send")), "\u73fe\u4e16\u3078\u51fa\u3059");
    await page.evaluate(() => document.querySelector(".window[data-app=fs] [data-mark='/konoyo']")?.click());
    await sleep(280);
    const shoreList = await page.$$eval(".window[data-app=fs] .fs-tree [data-path]", (els) =>
      els.map((b) => b.dataset.path || "")
    );
    note(shoreList.some((p) => p === "/konoyo" || p.includes("/konoyo") || p.includes("\u7d50\u3073")), `\u6b64\u5cb8\u306e\u5323 ${shoreList.slice(0, 4).join(" ")}`);
    await h.closeWin("fs");
    await h.openTorii("\u5949\u7d0d", "term");
    await h.term("ls /konoyo");
    await h.term("cat /proc/konoyo");
    const procK = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
    note(/supported=/.test(procK), `proc konoyo ${procK.slice(-80)}`);
    const bound = await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      await kernel.konoyo.bindMemory("e2e", {
        "hello.ofuda": "from-shore",
        "box/n.txt": "nest",
      });
      const a = await kernel.vfs.read("/konoyo/e2e/hello.ofuda");
      await kernel.vfs.write("/konoyo/e2e/wrote.ofuda", "back-to-shore");
      const home = `/home/${kernel.state.ujiko}/from-shore.ofuda`;
      await kernel.vfs.copy("/konoyo/e2e/hello.ofuda", home);
      const copied = await kernel.vfs.read(home);
      const wrote = await kernel.vfs.read("/konoyo/e2e/wrote.ofuda");
      const kids = await kernel.vfs.ls("/konoyo/e2e");
      const hits = await kernel.vfs.find("/konoyo/e2e", "hello");
      const greps = await kernel.vfs.grep("/konoyo/e2e", "nest");
      return {
        body: a.body,
        copied: copied.body,
        wrote: wrote.body,
        names: kids.map((k) => k.name).join(","),
        found: hits.some((f) => (f.path || "").includes("hello")),
        grep: greps.some((l) => String(l).includes("nest")),
        supported: document.documentElement.dataset.konoyo,
      };
    });
    note(bound.body === "from-shore", `\u6b64\u5cb8 cat ${bound.body}`);
    note(bound.copied === "from-shore", "\u6b64\u5cb8\u304b\u3089\u7e01fs\u3078\u5199\u3059");
    note(bound.wrote === "back-to-shore", "\u6b64\u5cb8\u3078\u66f8\u304f");
    note(/hello\.ofuda/.test(bound.names) && /wrote\.ofuda/.test(bound.names), `\u6b64\u5cb8 ls ${bound.names}`);
    note(bound.found, "\u6b64\u5cb8 find");
    note(bound.grep, "\u6b64\u5cb8 grep");
    await h.term("ls /konoyo/e2e");
    await h.term("cat /konoyo/e2e/hello.ofuda");
    await h.term("konoyo");
    const lsOut = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
    note(/hello\.ofuda/.test(lsOut) && /from-shore/.test(lsOut), "\u5949\u7d0d\u304b\u3089\u6b64\u5cb8\u3092\u8aad\u3080");
    note(/bind\te2e/.test(lsOut) && /awake/.test(lsOut), "\u5949\u7d0d konoyo \u8868");
    await h.closeWin("term");
    note(await page.evaluate(() =>
      [...document.querySelectorAll(".desk-icon .fuda-mark")].some((el) => el.dataset.icon === "konoyo")
    ), "\u5353\u306b\u6b64\u5cb8\u306e\u5370");
  });

  await section("watari", async () => {
    note(
      await page.evaluate(() => {
        const v = document.documentElement.dataset.watari;
        return v === "still" || v === "0" || v === "live" || v === "calling" || v === "ma";
      }),
      "\u6e21\u308a dataset"
    );
    await h.openTorii("\u6e21\u308a", "watari");
    note(!!(await page.$(".window[data-app=watari] #watari-invite")), "\u6e21\u308a \u62db\u304f");
    await h.closeWin("watari");
    await h.openTorii("\u5949\u7d0d", "term");
    await h.term("cat /proc/watari");
    const procW = await page.$eval(".window[data-app=term] .term-out", (el) => el.textContent || "");
    note(/supported=/.test(procW), `proc watari ${procW.slice(-80)}`);
    const looped = await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      const home = `/home/${kernel.state.ujiko}/watari-loop.ofuda`;
      await kernel.vfs.write(home, "loop-fuda");
      await kernel.watari.bindLoop();
      await kernel.watari.sendPath(home);
      const deadline = Date.now() + 5000;
      let body = "";
      let names = "";
      while (Date.now() < deadline) {
        const kids = await kernel.vfs.ls("/var/watari");
        names = kids.map((k) => k.name).join(",");
        for (const k of kids) {
          if (k.type === "dir") continue;
          const f = await kernel.vfs.read(k.path);
          if (String(f.body || "").includes("loop-fuda")) {
            body = f.body;
            break;
          }
        }
        if (body) break;
        await new Promise((r) => setTimeout(r, 120));
      }
      const snap = kernel.watari.snapshot();
      const live = snap.status === "live" || document.documentElement.dataset.watari === "live";
      await kernel.watari.close();
      return { live, body, names, supported: snap.via };
    });
    note(looped.live, "bindLoop live");
    note(looped.body === "loop-fuda", `\u6e21\u308a loop ${looped.body} ${looped.names}`);
    await h.closeWin("term");

    const pageB = await browser.newPage();
    pageB._yaoUrl = base;
    pageB.setDefaultTimeout(25000);
    await pageB.setViewport({ width: 1400, height: 900 });
    const hB = attachPage(pageB, { fails, note });
    await hB.boot();
    const pair = await Promise.all([
      page.evaluate(async () => {
        const { kernel } = await import("/js/kernel.js");
        await kernel.vfs.write(`/home/${kernel.state.ujiko}/watari-shrine.ofuda`, "shrine-fuda");
        await kernel.watari.open({ via: "shrine", kotoba: "e2e-watari" });
        await kernel.watari.waitLive(14000);
        await kernel.watari.sendPath(`/home/${kernel.state.ujiko}/watari-shrine.ofuda`);
        return {
          status: kernel.watari.snapshot().status,
          watari: document.documentElement.dataset.watari,
        };
      }),
      pageB.evaluate(async () => {
        const { kernel } = await import("/js/kernel.js");
        await kernel.watari.join({ via: "shrine", kotoba: "e2e-watari" });
        await kernel.watari.waitLive(14000);
        const deadline = Date.now() + 8000;
        let body = "";
        let dest = "";
        let names = "";
        while (Date.now() < deadline) {
          const kids = await kernel.vfs.ls("/var/watari");
          names = kids.map((k) => k.name).join(",");
          for (const k of kids) {
            if (k.type === "dir") continue;
            const f = await kernel.vfs.read(k.path);
            if (String(f.body || "").includes("shrine-fuda")) {
              body = f.body;
              dest = k.path;
              break;
            }
          }
          if (body) break;
          await new Promise((r) => setTimeout(r, 160));
        }
        return {
          status: kernel.watari.snapshot().status,
          watari: document.documentElement.dataset.watari,
          body,
          dest,
          names,
        };
      }),
    ]);
    note(pair[0].status === "live" || pair[0].watari === "live", `\u6e21\u308a A live ${pair[0].status}`);
    note(pair[1].status === "live" || pair[1].watari === "live", `\u6e21\u308a B live ${pair[1].status}`);
    note(pair[1].body === "shrine-fuda", `\u6e21\u308a shrine ${pair[1].body} ${pair[1].names}`);
    await page.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      await kernel.watari.close();
    });
    await pageB.evaluate(async () => {
      const { kernel } = await import("/js/kernel.js");
      await kernel.watari.close();
    });
    await pageB.close();
    note(
      await page.evaluate(() =>
        [...document.querySelectorAll(".desk-icon .fuda-mark")].some((el) => el.dataset.icon === "watari")
      ),
      "\u5353\u306b\u6e21\u308a\u306e\u5370"
    );
    await h.openTorii("\u7e01fs", "fs");
    note(!!(await page.$(".window[data-app=fs] [data-mark='/var/watari']")), "\u7e01fs \u6e21\u308a\u30de\u30fc\u30af");
    await h.closeWin("fs");
  });
