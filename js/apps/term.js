import { openPath } from "../runtime.js";

const HELP = `八百万OS 奉納シェル
  help                 この文
  whoami / 名簿        氏子
  oncall               今日の当直
  ps                   神プロセス
  ls [-l] [path]       縁fs
  cat <path>           読む
  write <path> <text>  書く
  mkdir <path>         匡を作る
  mv <from> <to>       名を移す
  rm <path>            無縁へ送る
  restore <path> [to]  無縁から戻す
  cp <from> <to>       写す
  echo text [> path]   言霊を出す
  head/tail/wc <path>  端と量
  uptime               通電からの間
  find [path] [名]     探す
  grep <pat> [path]    札の中
  stat <path>          属性
  df / du [path]       器の量
  cd [path]            匡を移る
  pwd                  今の匡
  history              奉納の履歴
  kashiwa              認証
  dmesg                核のログ
  ping [縁|県]         疎通
  migrate 東京         過密の再配置
  spawn <名> <役割>    神を立てる
  hounou <text>        奉納
  sysctl key=val       ma.silent / irq.ms / sound
  uname                機械
  date                 祭暦の今日
  top                  CPU上位
  clip [text]          言霊の控え
  chmod +x <path>      通電する札
  sh <path>            札を奉納として読む
  open <path|app>      くぐる
  alias [名=文]        言霊の略
  env / export / unset 場の変数
  ln <先> <名>         結び札
  touch <path>         時刻を撫でる
  hold/wake/nice       神を休ませる（殺さない）
  which <名>           言霊の出所
  cat /proc/*          核の仮想札
  tree [path]          匡の形
  diff <a> <b>         札の差
  echo text >> path    追記
  cmd | grep|sort|tee  管で繋ぐ
  logout               EPERM
  reboot               遷宮
  ↑↓ 履歴  Tab 補完
`;

const COMMANDS = [
  "help",
  "whoami",
  "名簿",
  "oncall",
  "ps",
  "ls",
  "cat",
  "write",
  "mkdir",
  "mv",
  "rm",
  "restore",
  "cp",
  "echo",
  "head",
  "tail",
  "wc",
  "uptime",
  "find",
  "grep",
  "stat",
  "df",
  "du",
  "cd",
  "pwd",
  "history",
  "kashiwa",
  "dmesg",
  "ping",
  "migrate",
  "spawn",
  "hounou",
  "sysctl",
  "uname",
  "date",
  "top",
  "clip",
  "chmod",
  "sh",
  "open",
  "alias",
  "env",
  "export",
  "unset",
  "ln",
  "touch",
  "tee",
  "sort",
  "uniq",
  "hold",
  "wake",
  "nice",
  "kill",
  "which",
  "tree",
  "diff",
  "ll",
  "logout",
  "reboot",
  "clear",
];
