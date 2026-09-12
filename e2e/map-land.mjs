import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./harness.mjs";

const full = readFileSync(join(ROOT, "svg/japan-prefectures.svg"), "utf8");
const n = (full.match(/<path\b[^>]*\sid="/g) || []).length;
if (n !== 47) {
  console.log(`FAIL 磁盤列島 ${n}`);
  process.exit(1);
}

const cut = full.indexOf('    <path id="kagawa"');
let stitched = cut >= 0 ? full.slice(0, cut) : "";
let parts = 0;
for (let i = 25; i <= 62; i += 1) {
  const p = join(ROOT, "svg/_parts", `${i}.txt`);
  if (!existsSync(p)) continue;
  stitched += readFileSync(p, "utf8");
  parts += 1;
}

if (parts !== 38 || cut < 0 || stitched !== full) {
  console.log(`FAIL 列島継ぎ parts=${parts} cut=${cut} eq=${stitched === full}`);
  process.exit(1);
}

console.log("PASS map-land");
