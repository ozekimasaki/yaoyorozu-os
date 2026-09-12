import { mkdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function freePort() {
  return new Promise((res) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = s.address().port;
      s.close(() => res(port));
    });
  });
}

export function startStatic(port) {
  const child = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], {
    cwd: ROOT,
    stdio: "ignore",
  });
  return child;
}

export async function waitHttp(url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url, { redirect: "manual" });
      if (r.status > 0) return;
    } catch (err) {
      /* not up */
    }
    await sleep(100);
  }
  throw new Error(`http not ready ${url}`);
}

export function makeNote() {
  const fails = [];
  const note = (ok, msg) => {
    console.log(`${ok ? "OK" : "NG"}  ${msg}`);
    if (!ok) fails.push(msg);
  };
  return { fails, note };
}

export function attachPage(page, { fails, note, shots } = {}) {
  page.on("pageerror", (err) => {
    console.log("PAGEERROR", err.message);
    fails.push(`pageerror ${err.message}`);
  });
  let shotN = 0;
  const shotRoot = shots || process.env.YAO_SHOTS || "";
  if (shotRoot) mkdirSync(shotRoot, { recursive: true });

  async function shot(name) {
    if (!shotRoot) return "";
    shotN += 1;
    const file = `${String(shotN).padStart(2, "0")}-${name}.png`;
    const dest = join(shotRoot, file);
    await page.screenshot({ path: dest, type: "png" });
    console.log(`SHOT ${file}`);
    return dest;
  }

  async function tap(sel) {
    const ok = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return false;
      el.click();
      return true;
    }, sel);
    await sleep(140);
    return ok;
  }

  async function desk() {
    await page.evaluate(() => document.getElementById("desktop")?.focus());
  }

  async function key(k, extra = {}) {
    await desk();
    await page.evaluate(
      (key, rest) => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...rest }));
      },
      k,
      extra
    );
    await sleep(160);
  }

  async function boot() {
    await page.goto(page._yaoUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("#boot-ready:not([hidden])");
    await page.click("#boot-skip");
    await page.waitForSelector("#desktop.on");
    await sleep(700);
    await page.evaluate(() => document.getElementById("kashiwa-stage")?.classList.remove("open"));
    await sleep(200);
  }

  async function openTorii(title, appId) {
    try {
      await page.evaluate(() => document.getElementById("torii-gate")?.classList.remove("open"));
      const opened = await page.evaluate(() => {
        const phone = document.documentElement.classList.contains("is-phone");
        const dock = document.querySelector("#phone-dock [data-phone=torii]");
        const brand = document.querySelector(".brand");
        if (phone && dock) {
          dock.click();
          return "dock";
        }
        if (brand) {
          brand.click();
          return "brand";
        }
        return "";
      });
      if (!opened) {
        note(false, `torii open ${title}`);
        return false;
      }
      await sleep(260);
      await page.evaluate((q) => {
        const box = document.querySelector("#torii-search");
        if (!box) return;
        box.value = q;
        box.dispatchEvent(new Event("input", { bubbles: true }));
      }, title);
      await sleep(280);
      const clicked = await page.evaluate((q) => {
        const items = [...document.querySelectorAll("#torii-list .torii-item, #torii-list button")];
        const exact = items.find((b) => (b.querySelector("strong")?.textContent || "").trim() === q);
        const hit = exact || items.find((b) => (b.textContent || "").includes(q));
        if (!hit) return false;
        hit.click();
        return true;
      }, title);
      if (!clicked) {
        await page.evaluate(() => document.getElementById("torii-gate")?.classList.remove("open"));
        note(false, `torii miss ${title}`);
        return false;
      }
      if (appId) await page.waitForSelector(`.window[data-app="${appId}"]`, { timeout: 8000 });
      await sleep(400);
      return true;
    } catch (err) {
      note(false, `torii ${title}: ${err.message}`);
      await page.evaluate(() => document.getElementById("torii-gate")?.classList.remove("open"));
      return false;
    }
  }

  async function awaitApp(appId, ms = 8000) {
    try {
      await page.waitForSelector(`.window[data-app="${appId}"]`, { timeout: ms });
      return true;
    } catch (err) {
      note(false, `\u7a93 ${appId} \u304c\u958b\u304b\u306a\u3044`);
      return false;
    }
  }

  async function closeWin(appId) {
    await page.evaluate((id) => {
      const win = id
        ? document.querySelector(`.window[data-app="${id}"]:not(.is-min)`)
        : document.querySelector(".window.focused") || document.querySelector(".window:not(.is-min)");
      win?.querySelector(".win-close")?.click();
    }, appId || "");
    await sleep(200);
  }

  async function vis(appId) {
    return page.$(`.window[data-app="${appId}"]:not(.is-min):not(.is-away)`);
  }

  async function term(cmd) {
    const ok = await page.evaluate((c) => {
      const input = document.querySelector(".window[data-app=term]:not(.is-min) input");
      if (!input) return false;
      input.focus();
      input.value = c;
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
      return true;
    }, cmd);
    note(ok, `\u5949\u7d0d ${cmd}`);
    await sleep(320);
  }

  async function closeKashiwa() {
    try {
      await page.evaluate(() => document.getElementById("kashiwa-stage")?.classList.remove("open"));
    } catch (err) {
      if (!String(err.message || err).includes("detached")) throw err;
    }
    await sleep(80);
  }

  async function clap() {
    try {
      await closeKashiwa();
      await key("k");
      await page.evaluate(() => document.querySelector("#kashiwa-stage [data-hand=left]")?.click());
      await sleep(80);
      await page.evaluate(() => document.querySelector("#kashiwa-stage [data-hand=right]")?.click());
      await sleep(1600);
      await closeKashiwa();
    } catch (err) {
      if (!String(err.message || err).includes("detached")) throw err;
      await boot();
      await closeKashiwa();
      await key("k");
      await page.evaluate(() => document.querySelector("#kashiwa-stage [data-hand=left]")?.click());
      await sleep(80);
      await page.evaluate(() => document.querySelector("#kashiwa-stage [data-hand=right]")?.click());
      await sleep(1600);
      await closeKashiwa();
    }
  }

  return { desk, key, boot, openTorii, closeWin, vis, term, closeKashiwa, clap, awaitApp, shot, tap };
}
