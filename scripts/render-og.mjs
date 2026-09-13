import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "/tmp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";
import { ROOT, sleep } from "../e2e/harness.mjs";

const CHROME = process.env.CHROME || "/usr/bin/google-chrome-stable";

function wrapSvg(svg, { width, height }) {
  return `<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8"/>
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: ${width}px;
        height: ${height}px;
        background: #0c0b09;
        overflow: hidden;
      }
      svg { display: block; width: ${width}px; height: ${height}px; }
    </style>
  </head>
  <body>${svg}</body>
</html>`;
}

async function shot(page, html, dest, width, height) {
  const file = join(mkdtempSync(join(tmpdir(), "yao-og-")), "card.html");
  writeFileSync(file, html, "utf8");
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await sleep(80);
  await page.screenshot({
    path: dest,
    type: "png",
    omitBackground: false,
    clip: { x: 0, y: 0, width, height },
  });
  console.log("wrote", dest);
}

const profile = mkdtempSync(join(tmpdir(), "yao-og-chrome-"));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  userDataDir: profile,
  args: ["--no-sandbox", "--disable-gpu", "--window-size=1200,630"],
});
const page = await browser.newPage();

const ogSvg = readFileSync(join(ROOT, "svg/ogp.svg"), "utf8").replace(/^<\?xml[^>]*>\s*/, "");
await shot(page, wrapSvg(ogSvg, { width: 1200, height: 630 }), join(ROOT, "og.png"), 1200, 630);

const fav = readFileSync(join(ROOT, "favicon.svg"), "utf8").replace(/^<\?xml[^>]*>\s*/, "");
await shot(page, wrapSvg(fav, { width: 180, height: 180 }), join(ROOT, "apple-touch-icon.png"), 180, 180);
await shot(page, wrapSvg(fav, { width: 512, height: 512 }), join(ROOT, "icons/app-512.png"), 512, 512);

await browser.close();
