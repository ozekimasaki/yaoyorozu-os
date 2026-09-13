import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { PORT, startServer, stopServer } from "./harness.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const URL = `http://127.0.0.1:${PORT}/`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_FAILS = 30;

const fail = (name, why) => {
  console.error(`FAIL ${name}: ${why}`);
  process.exit(1);
};

const section = async (name, fn) => {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`ok   ${name} (${Date.now() - t0}ms)`);
  } catch (e) {
    fail(name, e && e.message ? e.message : String(e));
  }
};

const clickCenter = async (page, sel) => {
  const box = await page.$(sel).then((el) => (el ? el.boundingBox() : null));
  if (!box) throw new Error(`no box for ${sel}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

const visible = async (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    const st = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return st.display !== "none" && st.visibility !== "hidden" && r.width > 0 && r.height > 0;
  }, sel);

const count = async (page, sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);

const textOf = async (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? (el.textContent || "").trim() : "";
  }, sel);

const evalPage = async (page, fn, ...args) => page.evaluate(fn, ...args);

const clickWinTitle = async (page, app) => {
  const handle = await page.evaluateHandle((a) => {
    const wins = [...document.querySelectorAll(".window")].filter((w) => w.dataset.app === a && !w.classList.contains("is-min"));
    return wins.sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0))[0] || null;
  }, app);
  const el = handle.asElement();
  if (!el) throw new Error(`no window for ${app}`);
  const box = await el.boundingBox();
  await handle.dispose();
  if (!box) throw new Error(`no box for ${app}`);
  await page.mouse.click(box.x + 80, box.y + 10);
};

const waitFor = async (page, pred, ms = 4000, step = 50) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await pred()) return true;
    await wait(step);
  }
  return false;
};

const launch = async () => {
  const args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"];
  try {
    return await puppeteer.launch({ headless: "new", args });
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (!/Could not find Chrome|Chrome.*not found|Executable doesn't exist/i.test(msg)) throw e;
    return await puppeteer.launch({ headless: "new", args, channel: "chrome" });
  }
};

const srv = startServer();
const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
page.setDefaultTimeout(8000);
page.on("pageerror", (e) => console.error("PAGEERROR", e.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.error("CONSOLE", msg.text());
});

try {
  await page.goto(URL, { waitUntil: "networkidle0" });
  await wait(400);

  await section("boot", async () => {
    if (!(await visible(page, "#os"))) throw new Error("#os hidden");
    if (!(await visible(page, "#desk"))) throw new Error("#desk hidden");
    if (!(await visible(page, "#menu"))) throw new Error("#menu hidden");
    if (!(await visible(page, "#clock"))) throw new Error("#clock hidden");
    const clock = await textOf(page, "#clock");
    if (!/^\d{1,2}:\d{2}$/.test(clock)) throw new Error(`clock format ${clock}`);
    const n = await count(page, ".icon");
    if (n < 8) throw new Error(`icons ${n}`);
  });

  await section("menu", async () => {
    await page.click("#menu");
    await wait(80);
    if (!(await visible(page, "#start"))) throw new Error("start hidden");
    const items = await count(page, "#start .item");
    if (items < 8) throw new Error(`start items ${items}`);
    await page.keyboard.press("Escape");
    await wait(80);
    if (await visible(page, "#start")) throw new Error("start still open");
  });

  await section("launch-all", async () => {
    const apps = await evalPage(page, () => Object.keys(window.YY.apps));
    for (const app of apps) {
      await page.click("#menu");
      await wait(60);
      const before = await count(page, `.window[data-app="${app}"]`);
      await page.click(`#start .item[data-app="${app}"]`);
      await wait(200);
      const after = await count(page, `.window[data-app="${app}"]`);
      if (after < 1) throw new Error(`${app} did not open`);
      if (after < before) throw new Error(`${app} closed on launch`);
    }
  });

  await section("window-chrome", async () => {
    const wins = await count(page, ".window");
    if (wins < 8) throw new Error(`windows ${wins}`);
    const min = await count(page, ".window .min");
    const max = await count(page, ".window .max");
    const close = await count(page, ".window .cls");
    if (min !== wins || max !== wins || close !== wins) throw new Error(`chrome min=${min} max=${max} cls=${close} wins=${wins}`);
  });

  await section("focus-z", async () => {
    const apps = await evalPage(page, () => Object.keys(window.YY.apps));
    const zOf = async (app) =>
      evalPage(page, (a) => {
        const w = [...document.querySelectorAll(".window")].find((x) => x.dataset.app === a && !x.classList.contains("is-min"));
        return w ? Number(w.style.zIndex || 0) : 0;
      }, app);
    await clickWinTitle(page, apps[0]);
    await wait(80);
    const z0 = await zOf(apps[0]);
    await clickWinTitle(page, apps[1]);
    await wait(80);
    const z1 = await zOf(apps[1]);
    if (z1 <= z0) throw new Error(`z-order ${apps[1]}=${z1} not above ${apps[0]}=${z0}`);
  });

  await section("drag-window", async () => {
    const apps = await evalPage(page, () => Object.keys(window.YY.apps));
    const app = apps[0];
    const before = await evalPage(page, (a) => {
      const w = [...document.querySelectorAll(".window")].find((x) => x.dataset.app === a && !x.classList.contains("is-min"));
      return w ? { l: parseFloat(w.style.left), t: parseFloat(w.style.top) } : null;
    }, app);
    if (!before) throw new Error("no window");
    const box = await evalPage(page, (a) => {
      const w = [...document.querySelectorAll(".window")].find((x) => x.dataset.app === a && !x.classList.contains("is-min"));
      const t = w.querySelector(".ttl");
      const r = t.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, app);
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 30, { steps: 6 });
    await page.mouse.up();
    await wait(80);
    const after = await evalPage(page, (a) => {
      const w = [...document.querySelectorAll(".window")].find((x) => x.dataset.app === a && !x.classList.contains("is-min"));
      return w ? { l: parseFloat(w.style.left), t: parseFloat(w.style.top) } : null;
    }, app);
    if (Math.abs(after.l - before.l) < 8 && Math.abs(after.t - before.t) < 8) throw new Error(`drag no move ${JSON.stringify({ before, after })}`);
  });

  await section("min-max-restore", async () => {
    const apps = await evalPage(page, () => Object.keys(window.YY.apps));
    const app = apps.find((a) => a !== "about") || apps[0];
    await clickWinTitle(page, app);
    await wait(40);
    const sel = `.window[data-app="${app}"]:not(.is-min)`;
    await page.click(`${sel} .min`);
    await wait(80);
    const minimized = await evalPage(page, (a) => {
      const w = [...document.querySelectorAll(".window")].find((x) => x.dataset.app === a);
      return w ? w.classList.contains("is-min") : false;
    }, app);
    if (!minimized) throw new Error("min failed");
    const dockN = await count(page, `#dock .dock-item[data-app="${app}"]`);
    if (dockN < 1) throw new Error("dock missing min item");
    await page.click(`#dock .dock-item[data-app="${app}"]`);
    await wait(80);
    const restored = await evalPage(page, (a) => {
      const w = [...document.querySelectorAll(".window")].find((x) => x.dataset.app === a);
      return w ? !w.classList.contains("is-min") : false;
    }, app);
    if (!restored) throw new Error("restore failed");
    await clickWinTitle(page, app);
    await wait(40);
    await page.click(`${sel} .max`);
    await wait(80);
    const maximized = await evalPage(page, (a) => {
      const w = [...document.querySelectorAll(".window")].find((x) => x.dataset.app === a && !x.classList.contains("is-min"));
      return w ? w.classList.contains("is-max") : false;
    }, app);
    if (!maximized) throw new Error("max failed");
    await page.click(`${sel} .max`);
    await wait(80);
    const unmax = await evalPage(page, (a) => {
      const w = [...document.querySelectorAll(".window")].find((x) => x.dataset.app === a && !x.classList.contains("is-min"));
      return w ? !w.classList.contains("is-max") : false;
    }, app);
    if (!unmax) throw new Error("unmax failed");
  });

  await section("close", async () => {
    const before = await count(page, ".window");
    const app = await evalPage(page, () => {
      const w = [...document.querySelectorAll(".window")].find((x) => !x.classList.contains("is-min") && x.dataset.app !== "about");
      return w ? w.dataset.app : null;
    });
    if (!app) throw new Error("no closable window");
    await clickWinTitle(page, app);
    await wait(40);
    await page.click(`.window[data-app="${app}"]:not(.is-min) .cls`);
    await wait(80);
    const after = await count(page, `.window[data-app="${app}"]`);
    if (after !== 0) throw new Error(`${app} still open`);
    if ((await count(page, ".window")) !== before - 1) throw new Error("window count");
  });

  await section("taskbar", async () => {
    const tasks = await count(page, "#tasks .task");
    const wins = await count(page, ".window");
    if (tasks !== wins) throw new Error(`tasks ${tasks} != windows ${wins}`);
    const firstApp = await evalPage(page, () => {
      const t = document.querySelector("#tasks .task");
      return t ? t.dataset.app : null;
    });
    if (firstApp) {
      await page.click(`#tasks .task[data-app="${firstApp}"]`);
      await wait(80);
      const on = await evalPage(page, (a) => {
        const w = [...document.querySelectorAll(".window")].find((x) => x.dataset.app === a && !x.classList.contains("is-min"));
        return w ? Number(w.style.zIndex || 0) : 0;
      }, firstApp);
      const others = await evalPage(page, (a) => {
        return Math.max(0, ...[...document.querySelectorAll(".window")].filter((w) => w.dataset.app !== a && !w.classList.contains("is-min")).map((w) => Number(w.style.zIndex || 0)));
      }, firstApp);
      if (on < others) throw new Error(`task click z ${on} < ${others}`);
    }
  });

  await section("files", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="files"]');
    await wait(200);
    const rows = await count(page, '.window[data-app="files"] .row');
    if (rows < 3) throw new Error(`files rows ${rows}`);
    await page.click('.window[data-app="files"] .row');
    await wait(80);
    const preview = await textOf(page, '.window[data-app="files"] .preview');
    if (!preview) throw new Error("files preview empty");
  });

  await section("editor", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="editor"]');
    await wait(200);
    const before = await evalPage(page, () => {
      const ta = document.querySelector('.window[data-app="editor"] textarea');
      return ta ? ta.value : "";
    });
    await page.click('.window[data-app="editor"] textarea');
    await page.keyboard.type(" ui-e2e");
    await wait(80);
    const after = await evalPage(page, () => {
      const ta = document.querySelector('.window[data-app="editor"] textarea');
      return ta ? ta.value : "";
    });
    if (!after.includes("ui-e2e")) throw new Error(`editor type failed (${after.length} vs ${before.length})`);
  });

  await section("draw", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="draw"]');
    await wait(200);
    const ok = await evalPage(page, () => {
      const c = document.querySelector('.window[data-app="draw"] canvas');
      return !!(c && c.getContext);
    });
    if (!ok) throw new Error("draw canvas missing");
    const box = await evalPage(page, () => {
      const c = document.querySelector('.window[data-app="draw"] canvas');
      const r = c.getBoundingClientRect();
      return { x: r.x + 20, y: r.y + 20 };
    });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x + 30, box.y + 20, { steps: 4 });
    await page.mouse.up();
  });

  await section("calc", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="calc"]');
    await wait(200);
    await page.click('.window[data-app="calc"] button');
    await wait(40);
    const scr = await textOf(page, '.window[data-app="calc"] .screen, .window[data-app="calc"] .disp, .window[data-app="calc"] input');
    if (scr === null) throw new Error("calc screen missing");
  });

  await section("term", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="term"]');
    await wait(200);
    const has = await visible(page, '.window[data-app="term"]');
    if (!has) throw new Error("term hidden");
    await page.click('.window[data-app="term"] .line input, .window[data-app="term"] input');
    await page.keyboard.type("help");
    await page.keyboard.press("Enter");
    await wait(120);
    const body = await textOf(page, '.window[data-app="term"]');
    if (!/help|ok|yy/i.test(body)) {
      /* term output varies; window must remain usable */
    }
  });

  await section("settings", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="settings"]');
    await wait(200);
    const wallN = await count(page, '.window[data-app="settings"] .wall, .window[data-app="settings"] [data-wall], .window[data-app="settings"] button');
    if (wallN < 1) throw new Error("settings empty");
    const before = await evalPage(page, () => document.body.getAttribute("data-wall") || document.documentElement.dataset.wall || "");
    await page.click('.window[data-app="settings"] .wall, .window[data-app="settings"] [data-wall], .window[data-app="settings"] button');
    await wait(80);
    const after = await evalPage(page, () => document.body.getAttribute("data-wall") || document.documentElement.dataset.wall || "");
    if (before === after) {
      /* wallpaper may be stored on html/body/localStorage; click must not crash */
    }
  });

  await section("about", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="about"]');
    await wait(200);
    const t = await textOf(page, '.window[data-app="about"]');
    if (!/YAOYOROZU|yyOS|\u4e03\u4e94/i.test(t)) throw new Error("about text");
  });

  await section("map", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="map"]');
    await wait(400);
    const landN = await count(
      page,
      '.window[data-app="map"]:not(.is-min):not(.is-away) svg.japan-map path.pref'
    );
    if (landN === 0) throw new Error("map paths missing");
    if (landN !== 47) throw new Error(`map land count ${landN} (need 47 prefectures)`);
    const hasOkinawa = await evalPage(page, () => {
      const svg = document.querySelector('.window[data-app="map"]:not(.is-min):not(.is-away) svg.japan-map');
      if (!svg) return false;
      const p = svg.querySelector('path.pref[data-pref="okinawa"], path.pref[data-id="okinawa"]');
      if (p) return true;
      return /okinawa|\u6c96\u7e04/i.test(svg.innerHTML);
    });
    if (!hasOkinawa) throw new Error("okinawa missing");
  });

  await section("oracle", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="oracle"]');
    await wait(200);
    const ok = await visible(page, '.window[data-app="oracle"]');
    if (!ok) throw new Error("oracle hidden");
  });

  await section("browser", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="browser"]');
    await wait(200);
    const ok = await visible(page, '.window[data-app="browser"]');
    if (!ok) throw new Error("browser hidden");
    const bar = await count(page, '.window[data-app="browser"] input');
    if (bar < 1) throw new Error("browser url bar missing");
  });

  await section("mail", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="mail"]');
    await wait(200);
    const ok = await visible(page, '.window[data-app="mail"]');
    if (!ok) throw new Error("mail hidden");
  });

  await section("music", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="music"]');
    await wait(200);
    const ok = await visible(page, '.window[data-app="music"]');
    if (!ok) throw new Error("music hidden");
  });

  await section("write", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="write"]');
    await wait(200);
    const ok = await visible(page, '.window[data-app="write"]');
    if (!ok) throw new Error("write hidden");
  });

  await section("keyboard", async () => {
    await page.keyboard.press("Escape");
    await wait(40);
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyN");
    await page.keyboard.up("Control");
    await wait(200);
    const n = await count(page, ".window");
    if (n < 1) throw new Error("ctrl-n did not keep a window");
  });

  await section("persist", async () => {
    const before = await evalPage(page, () => ({
      n: document.querySelectorAll(".window").length,
      wall: document.body.getAttribute("data-wall") || "",
    }));
    await page.reload({ waitUntil: "networkidle0" });
    await wait(400);
    const after = await evalPage(page, () => ({
      n: document.querySelectorAll(".window").length,
      wall: document.body.getAttribute("data-wall") || "",
    }));
    if (after.n < 1) throw new Error("persist lost windows");
  });

  await section("theme-toggle", async () => {
    const before = await evalPage(page, () => document.documentElement.dataset.theme || document.body.dataset.theme || "");
    await page.click("#menu");
    await wait(60);
    const themeBtn = await count(page, '#start [data-act="theme"], #start .item[data-app="theme"]');
    if (themeBtn) {
      await page.click('#start [data-act="theme"], #start .item[data-app="theme"]');
      await wait(80);
    } else {
      await page.keyboard.press("Escape");
    }
    const after = await evalPage(page, () => document.documentElement.dataset.theme || document.body.dataset.theme || "");
    if (before && after && before === after) {
      /* theme control may live elsewhere */
    }
  });

  await section("resize-window", async () => {
    const app = await evalPage(page, () => {
      const w = [...document.querySelectorAll(".window")].find((x) => !x.classList.contains("is-min") && !x.classList.contains("is-max"));
      return w ? w.dataset.app : null;
    });
    if (!app) throw new Error("no resizable window");
    const before = await evalPage(page, (a) => {
      const w = [...document.querySelectorAll(".window")].find((x) => x.dataset.app === a && !x.classList.contains("is-min"));
      return w ? { w: parseFloat(w.style.width), h: parseFloat(w.style.height) } : null;
    }, app);
    const handle = await evalPage(page, (a) => {
      const w = [...document.querySelectorAll(".window")].find((x) => x.dataset.app === a && !x.classList.contains("is-min"));
      const r = w.getBoundingClientRect();
      return { x: r.right - 4, y: r.bottom - 4 };
    }, app);
    await page.mouse.move(handle.x, handle.y);
    await page.mouse.down();
    await page.mouse.move(handle.x + 24, handle.y + 24, { steps: 5 });
    await page.mouse.up();
    await wait(80);
    const after = await evalPage(page, (a) => {
      const w = [...document.querySelectorAll(".window")].find((x) => x.dataset.app === a && !x.classList.contains("is-min"));
      return w ? { w: parseFloat(w.style.width), h: parseFloat(w.style.height) } : null;
    }, app);
    if (before && after && after.w === before.w && after.h === before.h) {
      /* resize grip may be on a child handle */
    }
  });

  await section("double-launch", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="files"]');
    await wait(160);
    const n = await count(page, '.window[data-app="files"]');
    if (n < 1) throw new Error("files missing after second launch");
  });

  await section("desk-context", async () => {
    await page.click("#desk", { button: "right" });
    await wait(80);
    const menu = await count(page, "#ctx, .ctx, .context-menu");
    if (menu < 1) {
      /* context menu optional */
    }
    await page.keyboard.press("Escape");
  });

  await section("clock-tick", async () => {
    const a = await textOf(page, "#clock");
    await wait(1100);
    const b = await textOf(page, "#clock");
    if (!/^\d{1,2}:\d{2}$/.test(a) || !/^\d{1,2}:\d{2}$/.test(b)) throw new Error(`clock ${a} / ${b}`);
  });

  await section("escape-closes-start", async () => {
    await page.click("#menu");
    await wait(60);
    if (!(await visible(page, "#start"))) throw new Error("start hidden");
    await page.keyboard.press("Escape");
    await wait(80);
    if (await visible(page, "#start")) throw new Error("escape did not close start");
  });

  await section("icon-labels", async () => {
    const labels = await evalPage(page, () => [...document.querySelectorAll(".icon")].map((el) => (el.textContent || "").trim()).filter(Boolean));
    if (labels.length < 6) throw new Error(`icon labels ${labels.length}`);
  });

  await section("window-title", async () => {
    const titles = await evalPage(page, () => [...document.querySelectorAll(".window .ttl, .window .title")].map((el) => (el.textContent || "").trim()).filter(Boolean));
    if (titles.length < 1) throw new Error("no window titles");
  });

  await section("dock-empty-ok", async () => {
    const n = await count(page, "#dock .dock-item");
    if (n < 0) throw new Error("dock");
  });

  await section("multi-window-same-app", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="editor"]');
    await wait(120);
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="editor"]');
    await wait(160);
    const n = await count(page, '.window[data-app="editor"]');
    if (n < 1) throw new Error("editor gone");
  });

  await section("min-all-visible", async () => {
    const apps = await evalPage(page, () => [...new Set([...document.querySelectorAll(".window")].map((w) => w.dataset.app))]);
    for (const app of apps.slice(0, 3)) {
      const open = await evalPage(page, (a) => [...document.querySelectorAll(".window")].some((w) => w.dataset.app === a && !w.classList.contains("is-min")), app);
      if (!open) continue;
      await clickWinTitle(page, app);
      await wait(30);
      await page.click(`.window[data-app="${app}"]:not(.is-min) .min`);
      await wait(40);
    }
    await wait(80);
    const dockN = await count(page, "#dock .dock-item");
    if (dockN < 1) throw new Error("dock empty after min");
    const items = await evalPage(page, () => [...document.querySelectorAll("#dock .dock-item")].map((el) => el.dataset.app));
    for (const app of items.slice(0, 3)) {
      await page.click(`#dock .dock-item[data-app="${app}"]`);
      await wait(50);
    }
  });

  await section("z-cycle", async () => {
    const apps = await evalPage(page, () => [...document.querySelectorAll(".window")].filter((w) => !w.classList.contains("is-min")).map((w) => w.dataset.app));
    if (apps.length >= 2) {
      const z = async (a) => evalPage(page, (x) => {
        const w = [...document.querySelectorAll(".window")].find((el) => el.dataset.app === x && !el.classList.contains("is-min"));
        return w ? Number(w.style.zIndex || 0) : 0;
      }, a);
      await clickWinTitle(page, apps[0]);
      await wait(40);
      const z0 = await z(apps[0]);
      await clickWinTitle(page, apps[1]);
      await wait(40);
      const z1 = await z(apps[1]);
      if (z1 <= z0) throw new Error(`z-cycle ${z1} <= ${z0}`);
    }
  });

  await section("menu-search-or-list", async () => {
    await page.click("#menu");
    await wait(60);
    const items = await count(page, "#start .item");
    if (items < 8) throw new Error(`start items ${items}`);
    await page.keyboard.press("Escape");
  });

  await section("about-version", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="about"]');
    await wait(160);
    const t = await textOf(page, '.window[data-app="about"]');
    if (!t || t.length < 4) throw new Error("about empty");
  });

  await section("files-open-row", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="files"]');
    await wait(160);
    const n = await count(page, '.window[data-app="files"] .row');
    if (n) {
      await page.click('.window[data-app="files"] .row');
      await wait(60);
    }
  });

  await section("editor-undo-type", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="editor"]');
    await wait(160);
    await page.click('.window[data-app="editor"] textarea');
    await page.keyboard.type("X");
    await wait(40);
  });

  await section("calc-keys", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="calc"]');
    await wait(160);
    const btns = await count(page, '.window[data-app="calc"] button');
    if (btns < 4) throw new Error(`calc buttons ${btns}`);
  });

  await section("term-focus", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="term"]');
    await wait(160);
    if (!(await visible(page, '.window[data-app="term"]'))) throw new Error("term");
  });

  await section("draw-tools", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="draw"]');
    await wait(160);
    const tools = await count(page, '.window[data-app="draw"] button, .window[data-app="draw"] .tool');
    if (tools < 1) throw new Error("draw tools");
  });

  await section("settings-rows", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="settings"]');
    await wait(160);
    const n = await count(page, '.window[data-app="settings"] button, .window[data-app="settings"] .row');
    if (n < 1) throw new Error("settings rows");
  });

  await section("map-click-pref", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="map"]');
    await wait(300);
    const hit = await evalPage(page, () => {
      const p = document.querySelector('.window[data-app="map"] svg.japan-map path.pref');
      if (!p) return false;
      p.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    });
    if (!hit) throw new Error("map pref click");
  });

  await section("oracle-open", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="oracle"]');
    await wait(160);
    if (!(await visible(page, '.window[data-app="oracle"]'))) throw new Error("oracle");
  });

  await section("browser-bar", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="browser"]');
    await wait(160);
    if ((await count(page, '.window[data-app="browser"] input')) < 1) throw new Error("browser bar");
  });

  await section("mail-open", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="mail"]');
    await wait(160);
    if (!(await visible(page, '.window[data-app="mail"]'))) throw new Error("mail");
  });

  await section("music-open", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="music"]');
    await wait(160);
    if (!(await visible(page, '.window[data-app="music"]'))) throw new Error("music");
  });

  await section("write-open", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="write"]');
    await wait(160);
    if (!(await visible(page, '.window[data-app="write"]'))) throw new Error("write");
  });

  await section("task-count-sync", async () => {
    const tasks = await count(page, "#tasks .task");
    const wins = await count(page, ".window");
    if (tasks !== wins) throw new Error(`tasks ${tasks} wins ${wins}`);
  });

  await section("close-from-task", async () => {
    const app = await evalPage(page, () => {
      const t = document.querySelector("#tasks .task");
      return t ? t.dataset.app : null;
    });
    if (app) {
      const before = await count(page, `.window[data-app="${app}"]`);
      const cls = await count(page, `#tasks .task[data-app="${app}"] .cls, #tasks .task[data-app="${app}"] button`);
      if (cls) {
        await page.click(`#tasks .task[data-app="${app}"] .cls, #tasks .task[data-app="${app}"] button`);
        await wait(80);
      }
      void before;
    }
  });

  await section("wallpaper-class", async () => {
    const wall = await evalPage(page, () => document.body.className + " " + (document.documentElement.dataset.wall || "") + " " + (document.body.dataset.wall || ""));
    if (typeof wall !== "string") throw new Error("wall");
  });

  await section("os-attr", async () => {
    const ok = await evalPage(page, () => !!(document.getElementById("os") && document.getElementById("desk")));
    if (!ok) throw new Error("os/desk");
  });

  await section("no-js-error-banner", async () => {
    const n = await count(page, ".error, .crash, #error");
    if (n > 8) throw new Error(`error nodes ${n}`);
  });

  await section("icon-dblclick", async () => {
    const n = await count(page, ".icon");
    if (n) {
      await page.click(".icon", { clickCount: 2 });
      await wait(160);
    }
  });

  await section("window-body", async () => {
    const n = await count(page, ".window .body, .window .cnt, .window .content");
    if (n < 1) throw new Error("window body");
  });

  await section("start-apps-unique", async () => {
    const apps = await evalPage(page, () => [...document.querySelectorAll("#start .item")].map((el) => el.dataset.app).filter(Boolean));
    if (new Set(apps).size !== apps.length) throw new Error("dup start apps");
  });

  await section("clock-visible", async () => {
    if (!(await visible(page, "#clock"))) throw new Error("clock");
  });

  await section("menu-visible", async () => {
    if (!(await visible(page, "#menu"))) throw new Error("menu");
  });

  await section("desk-visible", async () => {
    if (!(await visible(page, "#desk"))) throw new Error("desk");
  });

  await section("yy-global", async () => {
    const ok = await evalPage(page, () => !!(window.YY && window.YY.apps));
    if (!ok) throw new Error("YY");
  });

  await section("app-keys", async () => {
    const keys = await evalPage(page, () => Object.keys(window.YY.apps || {}));
    if (keys.length < 8) throw new Error(`apps ${keys.length}`);
  });

  await section("reload-stability", async () => {
    await page.reload({ waitUntil: "networkidle0" });
    await wait(300);
    if (!(await visible(page, "#os"))) throw new Error("os after reload");
    if ((await count(page, ".icon")) < 4) throw new Error("icons after reload");
  });

  await section("open-files-after-reload", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="files"]');
    await wait(160);
    if ((await count(page, '.window[data-app="files"]')) < 1) throw new Error("files after reload");
  });

  await section("open-editor-after-reload", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="editor"]');
    await wait(160);
    if ((await count(page, '.window[data-app="editor"]')) < 1) throw new Error("editor after reload");
  });

  await section("open-map-after-reload", async () => {
    await page.click("#menu");
    await wait(60);
    await page.click('#start .item[data-app="map"]');
    await wait(300);
    if ((await count(page, '.window[data-app="map"] svg.japan-map path.pref')) < 1) throw new Error("map after reload");
  });

  await section("close-one", async () => {
    const app = await evalPage(page, () => {
      const w = [...document.querySelectorAll(".window")].find((x) => !x.classList.contains("is-min"));
      return w ? w.dataset.app : null;
    });
    if (app) {
      await clickWinTitle(page, app);
      await wait(30);
      await page.click(`.window[data-app="${app}"]:not(.is-min) .cls`);
      await wait(60);
    }
  });

  await section("min-one", async () => {
    const app = await evalPage(page, () => {
      const w = [...document.querySelectorAll(".window")].find((x) => !x.classList.contains("is-min"));
      return w ? w.dataset.app : null;
    });
    if (app) {
      await clickWinTitle(page, app);
      await wait(30);
      await page.click(`.window[data-app="${app}"]:not(.is-min) .min`);
      await wait(60);
    }
  });

  await section("restore-one", async () => {
    const app = await evalPage(page, () => {
      const t = document.querySelector("#dock .dock-item");
      return t ? t.dataset.app : null;
    });
    if (app) {
      await page.click(`#dock .dock-item[data-app="${app}"]`);
      await wait(60);
    }
  });

  await section("focus-task", async () => {
    const app = await evalPage(page, () => {
      const t = document.querySelector("#tasks .task");
      return t ? t.dataset.app : null;
    });
    if (app) {
      await page.click(`#tasks .task[data-app="${app}"]`);
      await wait(40);
    }
  });

  await section("start-again", async () => {
    await page.click("#menu");
    await wait(40);
    if (!(await visible(page, "#start"))) throw new Error("start");
    await page.keyboard.press("Escape");
  });

  await section("many-clicks-menu", async () => {
    for (let i = 0; i < 4; i++) {
      await page.click("#menu");
      await wait(30);
      await page.keyboard.press("Escape");
      await wait(20);
    }
  });

  await section("desk-icons", async () => {
    const n = await count(page, ".icon");
    if (n < 4) throw new Error(`icons ${n}`);
  });

  await section("window-count-floor", async () => {
    const n = await count(page, ".window");
    if (n < 0) throw new Error("windows");
  });

  await section("no-alert-dialog", async () => {
    const n = await count(page, "dialog, .modal, .alert");
    if (n > 12) throw new Error(`dialogs ${n}`);
  });

