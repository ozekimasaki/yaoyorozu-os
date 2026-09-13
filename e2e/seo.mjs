import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, freePort, startStatic, waitHttp, makeNote } from "./harness.mjs";

const SITE = "https://ozekimasaki.github.io/yaoyorozu-os/";
const { fails, note } = makeNote();

function pngSize(path) {
  const buf = readFileSync(path);
  const sig = buf.subarray(0, 8).toString("hex");
  note(sig === "89504e470d0a1a0a", `${path} は PNG`);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length };
}

function mustExist(rel) {
  const path = join(ROOT, rel);
  note(existsSync(path), `ある ${rel}`);
  return path;
}

const html = readFileSync(join(ROOT, "index.html"), "utf8");
const robots = readFileSync(join(ROOT, "robots.txt"), "utf8");
const sitemap = readFileSync(join(ROOT, "sitemap.xml"), "utf8");
const manifest = readFileSync(join(ROOT, "manifest.webmanifest"), "utf8");
const fav = readFileSync(join(ROOT, "favicon.svg"), "utf8");
const ogSvg = readFileSync(join(ROOT, "svg/ogp.svg"), "utf8");
const notFound = readFileSync(join(ROOT, "404.html"), "utf8");

mustExist("favicon.svg");
mustExist("svg/ogp.svg");
mustExist("og.png");
mustExist("apple-touch-icon.png");
mustExist("icons/app-512.png");
mustExist("robots.txt");
mustExist("sitemap.xml");

note(fav.includes("<svg") && fav.includes("#c23a2b"), "favicon.svg は鳥居");
note(ogSvg.includes("八百万OS") && ogSvg.includes('width="1200"'), "ogp.svg は 1200 幅の題");

const og = pngSize(join(ROOT, "og.png"));
note(og.width === 1200 && og.height === 630, `og.png は 1200x630 (${og.width}x${og.height})`);
note(og.bytes > 8_000, `og.png の大きさ ${og.bytes}`);

const apple = pngSize(join(ROOT, "apple-touch-icon.png"));
note(apple.width === 180 && apple.height === 180, `apple-touch-icon.png は 180x180 (${apple.width}x${apple.height})`);

const app = pngSize(join(ROOT, "icons/app-512.png"));
note(app.width === 512 && app.height === 512, `app-512.png は 512x512 (${app.width}x${app.height})`);

note(html.includes('rel="canonical"') && html.includes(SITE), "canonical");
note(html.includes('property="og:image"') && html.includes(`${SITE}og.png`), "og:image");
note(html.includes('property="og:image:width"') && html.includes("1200"), "og:image:width");
note(html.includes('name="twitter:card"') && html.includes("summary_large_image"), "twitter:card");
note(html.includes('href="favicon.svg"') && html.includes('type="image/svg+xml"'), "favicon svg");
note(html.includes('type="application/ld+json"'), "JSON-LD");
note(html.includes("application/ld+json") && html.includes('"@type": "WebApplication"'), "JSON-LD WebApplication");
note(html.includes('rel="sitemap"') && html.includes("sitemap.xml"), "sitemap link");

const jsonLd = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
note(Boolean(jsonLd), "JSON-LD ブロック");
if (jsonLd) {
  try {
    const data = JSON.parse(jsonLd[1]);
    note(data["@type"] === "WebApplication", "JSON-LD 型");
    note(data.url === SITE, "JSON-LD url");
    note(data.image === `${SITE}og.png`, "JSON-LD image");
  } catch (err) {
    note(false, `JSON-LD が読めない ${err.message}`);
  }
}

note(robots.includes("Sitemap:") && robots.includes(`${SITE}sitemap.xml`), "robots sitemap");
note(sitemap.includes(`<loc>${SITE}</loc>`), "sitemap loc");
note(manifest.includes("favicon.svg") && manifest.includes("icons/app-512.png"), "manifest icons");
note(notFound.includes('content="noindex, nofollow"'), "404 noindex");
note(notFound.includes('href="favicon.svg"'), "404 favicon");

const port = await freePort();
const server = startStatic(port);
const origin = `http://127.0.0.1:${port}`;
await waitHttp(`${origin}/index.html`);

async function head(path, typePart) {
  const res = await fetch(`${origin}${path}`);
  const ctype = res.headers.get("content-type") || "";
  note(res.ok, `${path} ${res.status}`);
  note(ctype.includes(typePart), `${path} type ${ctype}`);
  return res;
}

await head("/favicon.svg", "image/svg+xml");
await head("/og.png", "image/png");
await head("/robots.txt", "text/plain");
await head("/sitemap.xml", "xml");
await head("/apple-touch-icon.png", "image/png");

const htmlRes = await fetch(`${origin}/index.html`);
const served = await htmlRes.text();
note(served.includes('property="og:title"'), "配信 HTML に og:title");

server.kill();

if (fails.length) {
  console.log(`FAIL ${fails.length}`);
  for (const f of fails) console.log(` - ${f}`);
  process.exit(1);
}
console.log("PASS seo");
