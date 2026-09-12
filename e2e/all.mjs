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
