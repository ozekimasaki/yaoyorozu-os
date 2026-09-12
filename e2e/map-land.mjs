import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./harness.mjs";

function countLand(markup) {
  return (markup.match(/<path\b[^>]*\sid="/g) || []).length;
}

const raw = readFileSync(join(ROOT, "svg/japan-prefectures.svg"), "utf8");
let parts = "";
let partN = 0;
for (let i = 25; i <= 62; i += 1) {
  const p = join(ROOT, "svg/_parts", `${i}.txt`);
  if (!existsSync(p)) continue;
  parts += readFileSync(p, "utf8");
  partN += 1;
}

const cut = raw.indexOf('    <path id="kagawa"');
const assembled = `${cut >= 0 ? raw.slice(0, cut) : raw}${parts}`;
const n = countLand(assembled);

if (partN !== 38) {
  console.log(`FAIL 列島断片 ${partN}`);
  process.exit(1);
}
<if (n !== 47 || !/<\/svg>/i.test(assembled)) {
  console.log(`FAIL 列島継ぎ ${n} closed=${/<\/svg>/i.test(assembled)}`);
  process.exit(1);
}
if (cut >= 0 && assembled !== raw) {
  console.log("FAIL 列島断片を継ぐと磁盤と一致しない");
  process.exit(1);
}

console.log(`PASS map-land ${n} raw=${countLand(raw)} parts=${partN}`);
