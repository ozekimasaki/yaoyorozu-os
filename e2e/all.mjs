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
