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

const profile = mkdtempSync(join(tmpdir(), "yao-phone-"));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  userDataDir: profile,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=390,844"],
});
const page = await browser.newPage();
page._yaoUrl = base;
page.setDefaultTimeout(20000);
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const shots = process.env.YAO_SHOTS || "/opt/cursor/artifacts/e2e-phone";
const h = attachPage(page, { fails, note, shots });

function front(appId) {
  return page.$(`.window[data-app="${appId}"]:not(.is-min):not(.is-away):not(.is-phone-back)`);
}

try {
  await h.boot();
  const phone = await page.evaluate(() => document.documentElement.classList.contains("is-phone"));
  note(phone, "html.is-phone");
  note(!!(await page.$("#desktop.on")), "\u5353\u304c\u70b9\u304f");
  const chrome = await page.evaluate(() => {
    const dock = document.getElementById("phone-dock");
    const bar = document.getElementById("phone-homebar");
    const task = document.querySelector(".taskbar");
    const hint = document.querySelector(".hint");
    const icons = document.getElementById("desktop-icons");
    const cs = (el) => (el ? getComputedStyle(el) : null);
    return {
      dock: cs(dock)?.display,
      bar: cs(bar)?.display,
      task: cs(task)?.display,
      hint: cs(hint)?.display,
      grid: cs(icons)?.display,
      iconPos: cs(icons?.querySelector(".desk-icon"))?.position,
      space: document.getElementById("phone-space")?.textContent || "",
    };
  });
  note(chrome.dock === "flex", `\u30c9\u30c3\u30af ${chrome.dock}`);
  note(chrome.bar === "block", `\u30db\u30fc\u30e0\u30d0\u30fc ${chrome.bar}`);
  note(chrome.task === "none", `\u30bf\u30b9\u30af\u30d0\u30fc\u975e\u8868\u793a ${chrome.task}`);
  note(chrome.hint === "none", `\u30d2\u30f3\u30c8\u975e\u8868\u793a ${chrome.hint}`);
  note(chrome.grid === "grid", `\u30db\u30fc\u30e0\u30b0\u30ea\u30c3\u30c9 ${chrome.grid}`);
  note(chrome.iconPos === "static", `\u672d\u306f\u9759\u7684 ${chrome.iconPos}`);
  note(!!chrome.space, `\u72b6\u6cc1\u306e\u7a7a\u9593 ${chrome.space}`);
  note(await page.evaluate(() =>
    [...document.querySelectorAll(".desk-icon")].some((b) => (b.textContent || "").includes("\u97f3\u970a"))
  ), "\u30db\u30fc\u30e0\u306b\u97f3\u970a");
  note(await page.evaluate(() =>
    [...document.querySelectorAll(".desk-icon .fuda-mark")].some((el) => el.dataset.icon === "konoyo")
  ), "\u30db\u30fc\u30e0\u306b\u6b64\u5cb8");
  const marks = await page.evaluate(() =>
    [...document.querySelectorAll(".desk-icon .fuda-mark")].map((el) => el.dataset.icon || el.querySelector("img")?.src || "")
  );
  note(marks.length >= 8, `\u672d\u30de\u30fc\u30af ${marks.length}`);
  note(new Set(marks).size === marks.length, `\u672d\u30de\u30fc\u30af\u56fa\u6709 ${marks.join(",")}`);
  const dockMarks = await page.evaluate(() =>
    [...document.querySelectorAll("#phone-dock .fuda-mark")].map((el) => el.dataset.icon || "")
  );
  note(dockMarks.length === 5 && new Set(dockMarks).size === 5, `\u30c9\u30c3\u30af\u56fa\u6709 ${dockMarks.join(",")}`);
  note(await page.evaluate(() => {
    const home = document.querySelector("#phone-dock [data-phone=home] .fuda-name");
    const raw = document.querySelector("#phone-dock [data-phone=home]")?.textContent || "";
    return home && home.textContent === "\u30db\u30fc\u30e0" && raw === "\u30db\u30fc\u30e0";
  }), "\u30c9\u30c3\u30af\u672d\u540d\u306f\u4e00\u5ea6");
  note(await page.evaluate(() =>
    [...document.querySelectorAll(".desk-icon img")].every((img) => img.complete && img.naturalWidth > 0)
  ), "\u672dSVG\u304c\u8aad\u3081\u308b");
  await h.shot("home");

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".desk-icon")].find((b) => (b.textContent || "").includes("\u5f53\u76f4"));
    if (!btn) return;
    btn.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: 48, clientY: 180, pointerId: 7 }));
  });
  await sleep(560);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".desk-icon")].find((b) => (b.textContent || "").includes("\u5f53\u76f4"));
    if (!btn) return;
    btn.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, pointerId: 7 }));
  });
  await sleep(240);
  note(await page.evaluate(() => {
    const el = document.getElementById("phone-actions");
    return el && !el.hidden;
  }), "\u672d\u30b7\u30fc\u30c8");
  note(!!(await page.$("#phone-actions [data-with=editor]")), "\u3053\u308c\u3067\u8a00\u970a");
  await h.shot("actions");
  await page.evaluate(() => document.querySelector("#phone-actions [data-with=editor]")?.click());
  await sleep(420);
  note(!!(await front("editor")), "\u672d\u3092\u8a00\u970a\u3067\u958b\u304f");
  await page.evaluate(() => document.getElementById("phone-home")?.click());
  await sleep(240);
  note(!(await front("editor")), "\u30b7\u30fc\u30c8\u304b\u3089\u5bb6\u3078");

  await h.clap();

  const opened = await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".desk-icon")].find((b) => (b.textContent || "").includes("\u5f53\u76f4"));
    if (!btn) return false;
    btn.click();
    return true;
  });
  note(opened, "\u672d\u3092\u305f\u305f\u304f");
  await sleep(500);
  note(!!(await front("oncall")), "\u5f53\u76f4\u304c\u30d5\u30eb\u30b9\u30af\u30ea\u30fc\u30f3");
  const scene = await page.evaluate(() => {
    const w = document.querySelector(".window[data-app=oncall]:not(.is-min)");
    if (!w) return null;
    const r = w.getBoundingClientRect();
    const desk = document.getElementById("desktop");
    return {
      w: Math.round(r.width),
      left: Math.round(r.left),
      app: desk?.classList.contains("is-app"),
      pin: getComputedStyle(w.querySelector(".win-pin") || document.body).display,
      rz: getComputedStyle(w.querySelector(".rz") || document.body).display,
    };
  });
  note(!!scene && scene.w >= 300 && scene.left <= 8, `\u753b\u9762\u5e45 ${scene && scene.w}`);
  note(!!scene && scene.app, "is-app");
  note(!!scene && scene.pin === "none", `\u30d4\u30f3\u975e\u8868\u793a ${scene && scene.pin}`);
  note(!!scene && scene.rz === "none", `\u30ea\u30b5\u30a4\u30ba\u975e\u8868\u793a ${scene && scene.rz}`);
  await h.shot("oncall");

  await page.evaluate(() => document.getElementById("phone-home")?.click());
  await sleep(280);
  note(!(await front("oncall")), "\u30db\u30fc\u30e0\u3067\u623b\u308b");
  note(await page.evaluate(() => !document.getElementById("desktop")?.classList.contains("is-app")), "\u30db\u30fc\u30e0\u306b\u672d");
  await h.shot("home-back");

  await page.evaluate(() => document.querySelector('#phone-dock [data-phone=torii]')?.click());
  await sleep(240);
  note(await page.evaluate(() => document.getElementById("torii-gate")?.classList.contains("open")), "\u30c9\u30c3\u30af\u3067\u9ce5\u5c45");
  await h.shot("torii");
  await page.evaluate(() => document.getElementById("torii-gate")?.classList.remove("open"));

  await page.evaluate(() => document.querySelector('#phone-dock [data-phone=term]')?.click());
  await sleep(500);
  note(!!(await front("term")), "\u30c9\u30c3\u30af\u3067\u5949\u7d0d");
  await h.shot("term");
  await page.evaluate(() => document.getElementById("phone-home")?.click());
  await sleep(200);
  await page.evaluate(() => document.getElementById("phone-home")?.click());
  await sleep(240);
  const recents = await page.evaluate(() => {
    const el = document.getElementById("phone-recents");
    const cards = [...document.querySelectorAll("#phone-recents .phone-card")].map((c) => c.textContent || "");
    return { open: el && !el.hidden, n: cards.length, text: cards.join("|") };
  });
  note(!!recents.open && recents.n >= 2, `\u6700\u8fd1\u306e\u5834\u9762 ${recents.n} ${recents.text.slice(0, 40)}`);
  await h.shot("recents");
  await page.evaluate(() => document.querySelector("#phone-recents .phone-card")?.click());
  await sleep(360);
  note(!!(await front("oncall")) || !!(await front("term")), "\u30ab\u30fc\u30c9\u3067\u5834\u9762\u3078");
  await page.evaluate(() => document.getElementById("phone-home")?.click());
  await sleep(200);
  const before = await page.$$eval(".window[data-app=oncall]", (els) => els.length);
  await page.evaluate(() => document.querySelector('#phone-dock [data-phone=oncall]')?.click());
  await sleep(360);
  const after = await page.$$eval(".window[data-app=oncall]", (els) => els.length);
  note(after === before && after >= 1, `\u30c9\u30c3\u30af\u306f\u8d77\u3053\u3059 ${before}->${after}`);
  note(!!(await front("oncall")), "\u8d77\u3053\u3057\u305f\u5f53\u76f4");
  await page.evaluate(() => document.getElementById("phone-home")?.click());
  await sleep(200);
  await page.evaluate(() => document.getElementById("phone-shade-hit")?.click());
  await sleep(200);
  note(await page.evaluate(() => {
    const el = document.getElementById("phone-shade");
    return el && !el.hidden;
  }), "\u901a\u77e5\u5e55");
  note(!!(await page.$("#phone-shade [data-shade=ma]")), "\u5e55\u306e\u9593");
  note(!!(await page.$("#phone-shade-journal")), "\u5e55\u306e\u65e5\u8a8c");
  await h.shot("shade");
  await page.evaluate(() => document.getElementById("phone-shade-hit")?.click());
  await sleep(160);

  await page.evaluate(() => document.getElementById("phone-home")?.click());
  await sleep(240);
  const splitOk = await page.evaluate(() => {
    const btns = [...document.querySelectorAll("#phone-recents [data-split]")];
    if (btns.length < 2) return false;
    btns[0].click();
    btns[1].click();
    return true;
  });
  note(splitOk, "\u4e26\u3076");
  await sleep(360);
  const splitScene = await page.evaluate(() => {
    const a = document.querySelector(".window.is-phone-split-a:not(.is-min)");
    const b = document.querySelector(".window.is-phone-split-b:not(.is-min)");
    return { a: a?.dataset.app || "", b: b?.dataset.app || "" };
  });
  note(!!splitScene.a && !!splitScene.b && splitScene.a !== splitScene.b, `\u5206\u5272 ${splitScene.a}+${splitScene.b}`);
  await h.shot("split");
  await page.evaluate(() => document.getElementById("phone-home")?.click());
  await sleep(240);
  note(!(await front("oncall")) && !(await front("term")), "\u5206\u5272\u304b\u3089\u30db\u30fc\u30e0");

  await page.evaluate(() => document.getElementById("phone-home")?.click());
  await sleep(240);
  const beforeCards = await page.$$eval("#phone-recents .phone-card", (els) => els.length).catch(() => 0);
  await page.evaluate(() => {
    const card = document.querySelector("#phone-recents .phone-card");
    if (!card) return;
    const r = card.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + 80;
    card.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 11 }));
    card.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, cancelable: true, clientX: x, clientY: y - 130, pointerId: 11 }));
    card.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, clientX: x, clientY: y - 130, pointerId: 11 }));
  });
  await sleep(280);
  let afterCards = await page.$$eval("#phone-recents .phone-card", (els) => els.length).catch(() => 0);
  if (beforeCards && afterCards >= beforeCards) {
    await page.evaluate(() => document.querySelector("#phone-recents [data-close]")?.click());
    await sleep(200);
    afterCards = await page.$$eval("#phone-recents .phone-card", (els) => els.length).catch(() => 0);
  }
  note(beforeCards === 0 || afterCards < beforeCards, `\u30ab\u30fc\u30c9\u9589\u3058 ${beforeCards}->${afterCards}`);
  await page.evaluate(() => {
    document.getElementById("phone-recents").hidden = true;
  });

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".desk-icon")].find((b) => (b.textContent || "").includes("\u97f3\u970a"));
    btn?.click();
  });
  await sleep(500);
  note(!!(await front("oto")), "\u97f3\u970a\u304c\u30d5\u30eb\u30b9\u30af\u30ea\u30fc\u30f3");
  await page.evaluate(() => document.querySelector(".window[data-app=oto] #oto-invite")?.click());
  await sleep(360);
  note(await page.$eval(".window[data-app=oto] .oto-app", (el) => el.dataset.state === "live").catch(() => false), "\u62db\u3044\u3066\u9cf4\u308b");
  await page.evaluate(() => document.getElementById("phone-home")?.click());
  await sleep(280);
  note(!(await front("oto")), "\u97f3\u970a\u304b\u3089\u30db\u30fc\u30e0");
  note(await page.evaluate(() => {
    const bar = document.getElementById("phone-now");
    const app = document.querySelector(".window[data-app=oto] .oto-app");
    return !!(bar && !bar.hidden && app && app.dataset.state === "live" && document.documentElement.dataset.oto === "live");
  }), "\u30db\u30fc\u30e0\u3067\u3082\u9cf4\u308b");
  await h.shot("now");
  await page.evaluate(() => document.querySelector("#phone-now [data-oto=toggle]")?.click());
  await sleep(220);
  note(await page.evaluate(() => {
    const app = document.querySelector(".window[data-app=oto] .oto-app");
    return !!(app && app.dataset.state === "ma" && document.documentElement.dataset.oto === "ma");
  }), "\u5e55\u4e0b\u3067\u9593");

  await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await sleep(300);
  note(await page.evaluate(() => document.documentElement.classList.contains("is-phone")), "\u6a2a\u3067\u3082\u30b9\u30de\u30dbOS");
  await h.shot("landscape");

  await page.setViewport({ width: 1400, height: 900, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });
  await sleep(400);
  note(!(await page.evaluate(() => document.documentElement.classList.contains("is-phone"))), "\u684c\u306b\u623b\u3059\u3068\u30c7\u30b9\u30af\u30c8\u30c3\u30d7");

  const err = await page.evaluate(() => window.__yaoPageError || "");
  note(!err, `pageerror ${err || "none"}`);
} catch (err) {
  note(false, err.message);
}

await browser.close();
server.kill();
if (fails.length) {
  console.log(`FAIL phone\n${fails.join("\n")}`);
  process.exit(1);
}
console.log(`PASS phone ${shots}`);
