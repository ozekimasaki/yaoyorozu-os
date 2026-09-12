import { bits16, hash32, hexFromHash, jstDateKey, mulberry32, pick } from "./rng.js";
import { createBus, tabId } from "./bus.js";
import { createVfs } from "./vfs.js";
import { attachCron } from "./cron.js";
import { assocText, defaultAssoc, parseAssoc, resolveOpen } from "./intent.js";

const KAMI_TEMPLATES = [
  { role: "路地", note: "狭い道ほど、縁は濃い。" },
  { role: "軒先", note: "雨宿りは、最短の聖域である。" },
  { role: "踏切", note: "待たされる時間も、通過である。" },
  { role: "自動販売機", note: "真夜中の灯は、無人の社である。" },
  { role: "自転車置き場", note: "鍵をかけた場所に、帰巣本能がある。" },
  { role: "団地の階段", note: "上りと下りで、隣人の名が違う。" },
  { role: "深夜ラジオ", note: "声だけの接続は、十分すぎる。" },
  { role: "バス停", note: "時刻表は、約束の化石である。" },
  { role: "銭湯の番台", note: "裸の合意形成。" },
  { role: "縁側", note: "内でも外でもないプロセス空間。" },
  { role: "郵便局", note: "届くことが、仕事である。" },
  { role: "図書館の返却口", note: "戻す儀礼が、蔵を生かす。" },
  { role: "工場の休憩室", note: "止まってよい時間が、保全である。" },
  { role: "漁港の朝", note: "潮が来なければ、会議はない。" },
  { role: "校庭の隅", note: "呼ばれなかった子の席を、残す。" },
];
