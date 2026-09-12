import { openPath, sharePath } from "../runtime.js";

const HELP = `八百万OS 奉納シェル
  help                 この文
  whoami / 名簿        氏子
  oncall               今日の当直
  ps                   神プロセス
  ls [-l] [path]       縁fs
  cat <path>           読む
  write <path> <text>  書く
  mkdir <path>         \u5323を作る
  mv <from> <to>       名を移す
  rm <path>            無縁へ送る
  restore <path> [to]  無縁から戻す
  cp <from> <to>       写す
  echo text [> path]   言霊を出す
  head/tail [-n N]     端
  wc <path>            量
  basename / dirname   名と\u5323
  nl <path>            行番号
  uptime               通電からの間
  find [path] [名]     探す
  grep <pat> [path]    札の中
  stat <path>          属性
  file <path>          札の種類
  df / du [path]       器の量
  cd [path]            \u5323を移る
  pwd                  今の\u5323
  history              奉納の履歴
  kashiwa              認証
  dmesg                核のログ
  ping [縁|県]         疎通
  migrate 東京         過密の再配置
  spawn <名> <役割>    神を立てる
  hounou <text>        奉納
  sysctl key=val       ma.silent / irq.ms / sound / ui.scale / fs.quota
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
  tree [path]          \u5323の形
  diff <a> <b>         札の差
  echo text >> path    追記
  purge                無縁を清める
  sync                 縁fsを確定する
  cmd | grep|sort|tee  管で繋ぐ
  cron / at / atq / atrm  \u6642\u5831
  assoc [match app]    \u672d\u306e\u95a2\u9023\u4ed8\u3051
  open -a <app> <path> \u3053\u308c\u3067\u958b\u304f
  share [-a app] <path> \u672d\u3092\u6e21\u3059
  journal              \u6838\u306e\u65e5\u8a8c
  oto [toggle|ma|next] \u97f3\u970a
  cat /proc/oto        \u4eca\u9cf4\u308b\u5ea7
  konoyo [bind|wake|unbind|take|send] \u6b64\u5cb8
  cat /proc/konoyo     \u6b64\u5cb8\u306e\u7d50
  watari [open|join|far|send|close] \u6e21\u308a
  cat /proc/watari     \u6e21\u308a\u306e\u821f
  utsushi [snap]       \u5199\u3057
  cat /proc/utsushi    \u5199\u3057\u306e\u7e01
  keshiki [set|clear|last] \u666f\u8272
  cat /proc/keshiki    \u666f\u8272\u306e\u7e01
  sweep                \u5668\u3092\u6383\u304f
  cat /proc/utsuwa     \u5668\u306e\u7e01
  okoshi [add|rm]      \u8d77\u3053\u3057
  cat /proc/okoshi     \u8d77\u3053\u3057\u306e\u7e01
  kill [-STOP|-CONT]   \u7a93\u3092\u4f11\u307e\u305b\u308b
  cat /proc/apps       \u7a93\u306e\u4f11\u6b62
  logout               EPERM
  reboot               遷宮
  ↑↓ 履歴  Ctrl+R 探る  Ctrl+L 清める  Tab 補完
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
  "basename",
  "dirname",
  "nl",
  "uptime",
  "find",
  "grep",
  "stat",
  "file",
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
  "purge",
  "sync",
  "logout",
  "reboot",
  "clear",
  "cron",
  "at",
  "atq",
  "atrm",
  "assoc",
  "journal",
  "share",
  "oto",
  "konoyo",
  "watari",
  "utsushi",
  "keshiki",
  "sweep",
  "okoshi",
];

export default {
  id: "term",
  title: "奉納",
  width: "min(720px, 84vw)",
  height: "min(520px, 70vh)",
  spawn({ kernel, launch, pid, wm, offer }) {
    const el = document.createElement("div");
    el.innerHTML = `
      <div class="term-out" id="term-out"></div>
      <div class="term-row"><span class="term-ps">神官 $</span><input type="text" autocomplete="off" spellcheck="false" aria-label="奉納コマンド" /></div>
    `;
    const outEl = el.querySelector(".term-out");
    const input = el.querySelector("input");
    const ps = el.querySelector(".term-ps");
    let cwd = kernel.state.termCwd || `/home/${kernel.state.ujiko}`;
    let histCursor = -1;
    let draft = "";
    let searchMode = false;
    let searchQ = "";
    let searchHits = [];
    let searchI = -1;

    let sink = null;
    function syncChrome() {
      const leaf = cwd === "/" ? "/" : cwd.split("/").filter(Boolean).pop() || cwd;
      ps.textContent = `${leaf} $`;
      if (wm && pid) wm.setTitle(pid, `${leaf} · hounou.sh`);
    }
    function out(text) {
      if (sink) {
        sink.push(String(text));
        return;
      }
      outEl.textContent += `${text}\n`;
      if (outEl.textContent.length > 16000) outEl.textContent = outEl.textContent.slice(-12000);
      outEl.scrollTop = outEl.scrollHeight;
    }

    function resolve(path) {
      if (!path) return cwd;
      return kernel.vfs.normalize(path.startsWith("/") ? path : `${cwd}/${path}`);
    }

    function historyList() {
      return kernel.state.history || [];
    }

    async function complete() {
      const raw = input.value;
      const lead = raw.match(/^\s*/)?.[0] || "";
      const body = raw.slice(lead.length);
      const parts = body.split(/\s+/);
      if (!body || parts.length === 1) {
        const hits = COMMANDS.filter((c) => c.startsWith(parts[0] || ""));
        if (hits.length === 1) {
          input.value = `${lead}${hits[0]}${hits[0] === "help" || hits[0] === "clear" ? "" : " "}`;
        } else if (hits.length) out(hits.join("  "));
        return;
      }
      const last = parts[parts.length - 1];
      const slash = last.lastIndexOf("/");
      const base = slash >= 0 ? last.slice(0, slash + 1) : "";
      const prefix = slash >= 0 ? last.slice(slash + 1) : last;
      let dir;
      try {
        dir = resolve(base || ".");
        const rows = await kernel.vfs.ls(dir);
        const hits = rows.filter((f) => f.name.startsWith(prefix));
        if (hits.length === 1) {
          const name = hits[0].type === "dir" ? `${hits[0].name}/` : hits[0].name;
          parts[parts.length - 1] = `${base}${name}`;
          input.value = `${lead}${parts.join(" ")}`;
        } else if (hits.length) {
          out(hits.map((f) => (f.type === "dir" ? `${f.name}/` : f.name)).join("  "));
        }
      } catch (err) {
        out(err.message || String(err));
      }
    }

    function expand(raw) {
      const env = kernel.state.env || {};
      return String(raw).replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, a, b) => {
        const k = a || b;
        return env[k] != null ? String(env[k]) : "";
      });
    }

    async function pipeInto(seg, stdin) {
      const [a, ...rest] = seg.split(/\s+/);
      if (a === "grep") sink.push(stdin.split("\n").filter((l) => l.includes(rest[0] || "")).join("\n"));
      else if (a === "head") sink.push(stdin.split("\n").slice(0, 12).join("\n"));
      else if (a === "tail") sink.push(stdin.split("\n").slice(-12).join("\n"));
      else if (a === "sort") sink.push(stdin.split("\n").sort((x, y) => x.localeCompare(y, "ja")).join("\n"));
      else if (a === "uniq") {
        const lines = [];
        for (const l of stdin.split("\n")) {
          if (lines[lines.length - 1] !== l) lines.push(l);
        }
        sink.push(lines.join("\n"));
      }       else if (a === "wc") {
        sink.push(`${stdin.split("\n").length} ${stdin.split(/\s+/).filter(Boolean).length} ${stdin.length}`);
      } else if (a === "nl") {
        sink.push(stdin.split("\n").map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join("\n"));
      } else if (a === "tee") {
        const path = resolve(rest[0]);
        await kernel.vfs.write(path, stdin);
        kernel.noteRecent(path);
        kernel.emit("vfs");
        sink.push(stdin);
      } else out(`pipe: ${a} には繋げない`);
    }

    async function runScript(body) {
      for (const raw of String(body || "").split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        out(`  > ${line}`);
        await run(line, false);
      }
    }

    async function handle(raw) {
      const typed = raw.trim();
      if (!typed) return;
      const line = expand(typed);
      histCursor = -1;
      draft = "";
      out(`神官 $ ${typed}`);
      try {
        const segs = line.split("|").map((s) => s.trim()).filter(Boolean);
        if (segs.length > 1) {
          kernel.pushHistory(typed);
          let text = "";
          for (let i = 0; i < segs.length; i += 1) {
            sink = [];
            if (i === 0) await run(segs[i], false);
            else await pipeInto(segs[i], text);
            text = sink.join("\n");
            sink = null;
          }
          out(text);
          return;
        }
        await run(line, true, typed);
      } catch (err) {
        out(err.message || String(err));
        if (err.message === "EPERM" && !line.startsWith("logout")) kernel.emit("need-auth");
      }
    }

    async function run(line, hist, typed) {
      if (hist) kernel.pushHistory(typed || line);
      let [a, ...rest] = line.split(/\s+/);
      const aliases = kernel.state.aliases || {};
      if (aliases[a]) {
        const exp = `${aliases[a]} ${rest.join(" ")}`.trim();
        [a, ...rest] = exp.split(/\s+/);
      }
      if (a === "ll") {
        a = "ls";
        rest = ["-l", ...rest];
      }
      const restText = rest.join(" ");
      switch (a) {
          case "help":
            out(HELP);
            break;
          case "whoami":
          case "名簿":
            out(
              `uid=${kernel.state.ujiko}\nvisits=${kernel.state.visits}\nlogoutDays=${kernel.state.logoutDays}\nspace=${kernel.spacePref().name}\nauth=${kernel.state.authenticated}`
            );
            break;
          case "oncall": {
            const o = kernel.state.oncall;
            out(`entropy=${o.entropy}\nkami=${o.kami.name}\nkernel=${o.pref.name}\narticle=${o.article}\nstatus=${kernel.state.officialStatus || "AUTH required"}`);
            break;
          }
          case "ps": {
            const kami = kernel.state.processes
              .filter((p) => p.kind !== "app")
              .slice(0, 40)
              .map((p) => `${String(p.pid).padStart(4)} ${(p.status || "").padEnd(10)} ${p.name}`);
            const apps = (kernel.state.appProcs || []).map(
              (p) => `${String(p.pid).padStart(4)} ${(p.status || "running").padEnd(10)} ${p.appId}`
            );
            out([...kami, ...(apps.length ? ["-- apps --", ...apps] : [])].join("\n"));
            break;
          }
          case "ls": {
            const long = rest[0] === "-l";
            const path = resolve(long ? rest[1] : rest[0]);
            const rows = await kernel.listPath(path);
            if (long) {
              out(
                rows
                  .map((f) => {
                    const kind = f.type === "dir" ? "d" : f.type === "link" ? "l" : "-";
                    const sz = f.type === "dir" ? 0 : (f.body || "").length;
                    const t = f.updated ? new Date(f.updated).toISOString().slice(0, 16).replace("T", " ") : "";
                    const arrow = f.type === "link" && f.target ? ` -> ${f.target}` : "";
                    return `${kind}${f.exec ? "x" : "-"} ${String(sz).padStart(6)} ${t} ${f.name}${arrow}`;
                  })
                  .join("\n") || "（空）"
              );
            } else {
              out(
                rows
                  .map((f) => `${f.type === "dir" ? "d" : f.type === "link" ? "l" : "-"} ${f.name}`)
                  .join("\n") || "（空）"
              );
            }
            break;
          }
          case "find": {
            let path = cwd;
            let needle = "";
            if (rest.length === 1) {
              if (rest[0].startsWith("/") || rest[0] === "." || rest[0] === "..") path = resolve(rest[0]);
              else needle = rest[0];
            } else if (rest.length >= 2) {
              path = resolve(rest[0]);
              needle = rest.slice(1).join(" ");
            }
            const rows = await kernel.vfs.find(path, needle);
            out(rows.map((f) => f.path).join("\n") || "（空）");
            break;
          }
          case "grep": {
            const pat = rest[0];
            const path = resolve(rest[1] || ".");
            const hits = await kernel.vfs.grep(path, pat);
            out(hits.join("\n") || "（空）");
            break;
          }
          case "stat": {
            const path = resolve(rest[0]);
            const f = kernel.procRead(path) || (await kernel.vfs.getFile(path));
            if (!f) throw new Error("ENOENT");
            const extra = f.type === "link" ? `\ntarget=${f.target || ""}` : "";
            out(
              `path=${f.path}\ntype=${f.type}\nbytes=${(f.body || "").length}\nmime=${f.mime || ""}\nupdated=${f.updated || ""}\norigin=${f.origin || ""}${extra}`
            );
            break;
          }
          case "file": {
            const path = resolve(rest[0]);
            if (kernel.procRead(path)) {
              out(`${path}: 核の仮想札`);
              break;
            }
            const f = await kernel.vfs.getFile(path);
            if (!f) throw new Error("ENOENT");
            if (f.type === "dir") out(`${path}: \u5323`);
            else if (f.type === "link") out(`${path}: 結び → ${f.target || ""}`);
            else out(`${path}: 札 ${f.mime || "text/plain"} ${(f.body || "").length}B`);
            break;
          }
          case "df": {
            const u = await kernel.vfs.usage("/");
            const q = kernel.vfs.quotaOf ? kernel.vfs.quotaOf() : 0;
            out(`縁fs  files=${u.files} dirs=${u.dirs} bytes=${u.bytes} quota=${q}`);
            break;
          }
          case "du": {
            const path = resolve(rest[0] || ".");
            const u = await kernel.vfs.usage(path);
            out(`${path}  files=${u.files} dirs=${u.dirs} bytes=${u.bytes}`);
            break;
          }
          case "restore": {
            const dest = await kernel.vfs.restoreFromMuen(resolve(rest[0]), rest[1] ? resolve(rest[1]) : undefined);
            kernel.noteRecent(dest);
            out(`restore → ${dest}`);
            kernel.emit("vfs");
            break;
          }
          case "cp": {
            const dest = resolve(rest[1]);
            await kernel.vfs.copy(resolve(rest[0]), dest);
            kernel.noteRecent(dest);
            out(`cp → ${dest}`);
            kernel.emit("vfs");
            break;
          }
          case "echo": {
            const append = restText.match(/^(.*)>>\s*(\S+)\s*$/);
            const redir = !append && restText.match(/^(.*)>\s*(\S+)\s*$/);
            const hit = append || redir;
            if (hit) {
              const path = resolve(hit[2]);
              if (append) await kernel.vfs.append(path, hit[1].trim());
              else await kernel.vfs.write(path, hit[1].trim());
              kernel.noteRecent(path);
              out(path);
              kernel.emit("vfs");
            } else {
              out(restText);
            }
            break;
          }
          case "tree": {
            const root = resolve(rest[0] || ".");
            const lines = [root];
            const walk = async (dir, prefix, depth) => {
              if (depth > 5 || lines.length > 160 || dir.includes("/shrines")) return;
              let rows = [];
              try {
                rows = await kernel.listPath(dir);
              } catch (err) {
                return;
              }
              rows.sort((a, b) => a.name.localeCompare(b.name, "ja"));
              for (let i = 0; i < rows.length; i += 1) {
                const f = rows[i];
                const last = i === rows.length - 1;
                const mark = f.type === "dir" ? "▸" : f.type === "link" ? "↦" : "·";
                lines.push(`${prefix}${last ? "└" : "├"} ${mark} ${f.name}`);
                if (f.type === "dir") {
                  await walk(f.path, `${prefix}${last ? "  " : "│ "}`, depth + 1);
                }
              }
            };
            await walk(root, "", 0);
            out(lines.join("\n"));
            break;
          }
          case "diff": {
            const a = await kernel.readPath(resolve(rest[0]));
            const b = await kernel.readPath(resolve(rest[1]));
            const la = String(a.body || "").split("\n");
            const lb = String(b.body || "").split("\n");
            const rows = [];
            const n = Math.max(la.length, lb.length);
            for (let i = 0; i < n; i += 1) {
              if (la[i] === lb[i]) continue;
              if (la[i] != null) rows.push(`- ${la[i]}`);
              if (lb[i] != null) rows.push(`+ ${lb[i]}`);
            }
            out(rows.join("\n") || "（同じ）");
            break;
          }
          case "basename":
            out(kernel.vfs.nameOf(resolve(rest[0])));
            break;
          case "dirname":
            out(kernel.vfs.parentOf(resolve(rest[0])));
            break;
          case "nl": {
            const f = await kernel.readPath(resolve(rest[0]));
            out(f.body.split("\n").map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join("\n"));
            break;
          }
          case "head":
          case "tail": {
            let n = 12;
            let pathArg = rest[0];
            if (rest[0] === "-n" && rest[1]) {
              n = Math.max(1, Number(rest[1]) || 12);
              pathArg = rest[2];
            } else if (rest[0] && /^-\d+$/.test(rest[0])) {
              n = Math.max(1, Number(rest[0].slice(1)));
              pathArg = rest[1];
            }
            const f = await kernel.readPath(resolve(pathArg));
            const lines = f.body.split("\n");
            const slice = a === "head" ? lines.slice(0, n) : lines.slice(-n);
            out(slice.join("\n"));
            break;
          }
          case "wc": {
            const f = await kernel.readPath(resolve(rest[0]));
            const lines = f.body ? f.body.split("\n").length : 0;
            out(`${lines} ${f.body.split(/\s+/).filter(Boolean).length} ${(f.body || "").length} ${resolve(rest[0])}`);
            break;
          }
          case "sort": {
            const f = await kernel.readPath(resolve(rest[0]));
            out(f.body.split("\n").sort((x, y) => x.localeCompare(y, "ja")).join("\n"));
            break;
          }
          case "uniq": {
            const f = await kernel.readPath(resolve(rest[0]));
            const lines = [];
            for (const l of f.body.split("\n")) {
              if (lines[lines.length - 1] !== l) lines.push(l);
            }
            out(lines.join("\n"));
            break;
          }
          case "tee": {
            const path = resolve(rest[0]);
            await kernel.vfs.write(path, rest.slice(1).join(" "));
            kernel.noteRecent(path);
            out(path);
            kernel.emit("vfs");
            break;
          }
          case "uptime": {
            const ms = Date.now() - (kernel.bootedAt || Date.now());
            out(`${Math.floor(ms / 1000)}s 通電 · visits=${kernel.state.visits} · logoutDays=${kernel.state.logoutDays}`);
            break;
          }
          case "cat": {
            const path = resolve(rest[0]);
            const f = await kernel.readPath(path);
            if (f.mime !== "text/proc") kernel.noteRecent(f.path || path);
            out(f.body.slice(0, 4000));
            break;
          }
          case "write": {
            const path = resolve(rest[0]);
            const text = rest.slice(1).join(" ");
            await kernel.vfs.write(path, text);
            kernel.noteRecent(path);
            out(`wrote ${path}`);
            kernel.emit("vfs");
            break;
          }
          case "mkdir": {
            const path = resolve(rest[0]);
            await kernel.vfs.mkdir(path);
            out(`mkdir ${path}`);
            kernel.emit("vfs");
            break;
          }
          case "mv": {
            const from = resolve(rest[0]);
            const to = resolve(rest[1]);
            await kernel.vfs.rename(from, to);
            kernel.noteRecent(to);
            out(`mv ${from} → ${to}`);
            kernel.emit("vfs");
            break;
          }
          case "rm": {
            const path = resolve(rest[0]);
            const dest = await kernel.vfs.moveToMuen(path);
            out(`無縁へ ${path} → ${dest}`);
            kernel.emit("vfs");
            break;
          }
          case "pwd":
            out(cwd);
            break;
          case "history":
            out(historyList().map((h, i) => `${String(i).padStart(3)}  ${h}`).join("\n") || "（空）");
            break;
          case "kashiwa": {
            const r = kernel.kashiwa(kernel.state.officialDay === kernel.state.oncall.day ? "reauth" : "official");
            out(`${r.status}\n${r.copy}\nnext=${r.job.kind}`);
            kernel.emit("job", r.job);
            break;
          }
          case "dmesg":
            out(kernel.state.dmesg.slice(-20).join("\n"));
            break;
          case "ping":
            {
              const r = kernel.ping(rest[0] || "縁");
              out(`64 bytes from ${r.dest.name}: time=${r.ms} ms`);
            }
            break;
          case "migrate":
            {
              const dest = kernel.migrateTokyo();
              out(`migrating 過密の龍 → ${dest.name}`);
              kernel.emit("spotlight", dest.id);
            }
            break;
          case "spawn":
            {
              const kami = kernel.spawnKami({ name: rest[0], role: rest.slice(1).join(" ") });
              out(`spawned ${kami.name} pid=${kami.pid}`);
            }
            break;
          case "hounou":
            {
              const rec = kernel.hounou(restText);
              out(`奉納 → ${rec.to}`);
            }
            break;
          case "uname":
            out(`YaoyorozuOS browser ${kernel.state.ujiko} ${kernel.spacePref().name}`);
            break;
          case "date":
            out(`${kernel.state.oncall.day} 季節=${kernel.spacePref().season} entropy=${kernel.state.oncall.entropy}`);
            break;
          case "top":
            out(
              kernel.state.processes
                .filter((p) => p.kind !== "app")
                .slice()
                .sort((a, b) => (b.cpu || 0) - (a.cpu || 0))
                .slice(0, 12)
                .map((p) => `${String(p.cpu | 0).padStart(3)}%  ${p.name}`)
                .join("\n")
            );
            break;
          case "clip":
            if (restText) {
              kernel.clipPush(restText);
              out("控えた");
            } else {
              out((kernel.state.clipboard || []).slice(0, 8).map((c) => c.t).join("\n") || "（空）");
            }
            break;
          case "sysctl": {
            const [k, v] = (rest[0] || "").split("=");
            const s = kernel.sysctl(k, v);
            const scale = s.scale != null ? s.scale : kernel.keshiki && kernel.keshiki.snapshot ? kernel.keshiki.snapshot().scale : 1;
            const quota = s.quota != null ? s.quota : kernel.vfs.quotaOf ? kernel.vfs.quotaOf() : 0;
            out(`silent=${s.silent} irq.ms=${s.irqMs} sound=${s.sound} scale=${scale} quota=${quota}`);
            break;
          }
          case "logout":
            kernel.logout();
            break;
          case "reboot":
            out("式年遷宮を前倒ししています。人は残し、権威のホコリは捨てます。");
            setTimeout(() => window.location.reload(), 500);
            break;
          case "cd":
            cwd = resolve(rest[0] || `/home/${kernel.state.ujiko}`);
            kernel.state.termCwd = cwd;
            kernel.commit();
            syncChrome();
            out(cwd);
            break;
          case "purge": {
            const n = await kernel.vfs.purgeMuen();
            kernel.noteOshi(`無縁を清めた ${n}`, "muen");
            out(`cleared ${n}`);
            kernel.emit("vfs");
            break;
          }
          case "sync":
            await kernel.commit(true);
            out("ok");
            break;
          case "clear":
            outEl.textContent = "";
            break;
          case "chmod": {
            let on = rest[0] === "+x" || rest[0] === "755";
            let dest = resolve(rest[1] || rest[0]);
            if (rest[0] === "-x") {
              on = false;
              dest = resolve(rest[1]);
            }
            await kernel.vfs.chmod(dest, on);
            out(`${on ? "exec" : "noexec"} ${dest}`);
            break;
          }
          case "sh": {
            const f = await kernel.vfs.read(resolve(rest[0]));
            await runScript(f.body);
            break;
          }
          case "open": {
            let withId = "";
            const args = rest.slice();
            if (args[0] === "-a" || args[0] === "--with") {
              withId = args[1] || "";
              args.splice(0, 2);
            }
            const id = args[0];
            if (!id) throw new Error("EINVAL");
            if (id.startsWith("/") || id.startsWith("./") || id.includes(".")) {
              openPath(resolve(id), withId ? { with: withId } : {});
            } else launch(withId || id);
            out(withId ? `open -a ${withId} ${id}` : `open ${id}`);
            break;
          }
          case "assoc": {
            if (!rest[0]) {
              const rows = await kernel.assocTable();
              out(rows.map((r) => `${r.match}  ${r.app}`).join("\n"));
              break;
            }
            if (!rest[1]) throw new Error("EINVAL");
            await kernel.assocSet(rest[0], rest[1]);
            out(`assoc ${rest[0]} ${rest[1]}`);
            break;
          }
          case "journal":
            out(kernel.journalText());
            break;
          case "oto":
            if (rest[0]) kernel.otoCmd(rest[0]);
            out(kernel.otoText());
            break;
          case "konoyo": {
            const k = kernel.konoyo;
            if (!k) throw new Error("ENOSYS");
            const sub = rest[0] || "";
            if (!sub) {
              out(k.procText());
              break;
            }
            if (sub === "bind") {
              const rec = await k.bindDir();
              out(`bind ${rec.id} ${rec.name}`);
              break;
            }
            if (sub === "unbind") {
              if (!rest[1]) throw new Error("EINVAL");
              await k.unbind(rest[1]);
              out(`unbind ${rest[1]}`);
              break;
            }
            if (sub === "wake") {
              if (!rest[1]) throw new Error("EINVAL");
              await k.wake(rest[1]);
              out(`wake ${rest[1]}`);
              break;
            }
            if (sub === "take") {
              const dest = rest[1] ? resolve(rest[1]) : cwd;
              const paths = await k.takeIn(dest);
              out(paths.join("\n") || "empty");
              break;
            }
            if (sub === "send") {
              if (!rest[1]) throw new Error("EINVAL");
              const name = await k.sendOut(resolve(rest[1]));
              out(`send ${name}`);
              break;
            }
            out("konoyo [bind|unbind|wake|take|send]");
            break;
          }
          case "watari": {
            const w = kernel.watari;
            if (!w) throw new Error("ENOSYS");
            const sub = rest[0] || "";
            if (!sub || sub === "stat") {
              out(w.procText());
              break;
            }
            if (sub === "open") {
              await w.open({ via: "shrine", kotoba: rest[1] || "" });
              out(w.procText());
              break;
            }
            if (sub === "join") {
              await w.join({ via: "shrine", kotoba: rest[1] || "" });
              out(w.procText());
              break;
            }
            if (sub === "far") {
              const joinFar = rest[1] === "join";
              const kotoba = joinFar ? rest[2] : rest[1];
              if (joinFar) await w.join({ via: "kotoba", kotoba: kotoba || "" });
              else await w.open({ via: "kotoba", kotoba: kotoba || "" });
              out(w.procText());
              break;
            }
            if (sub === "send") {
              const raw = rest.slice(1).join(" ");
              if (!raw) throw new Error("EINVAL");
              if (raw.startsWith("/") || raw.includes(".")) await w.sendPath(resolve(raw));
              else await w.sendText(raw);
              out(w.procText());
              break;
            }
            if (sub === "close") {
              await w.close();
              out(w.procText());
              break;
            }
            out("watari [open|join|far|send|close]");
            break;
          }
          case "utsushi": {
            const u = kernel.utsushi;
            if (!u) throw new Error("ENOSYS");
            const sub = rest[0] || "";
            if (!sub || sub === "stat") {
              out(u.procText());
              break;
            }
            if (sub === "snap" || sub === "utsusu" || sub === "\u6620\u3059") {
              const hit = await u.snap({ reason: "term" });
              out(hit.path);
              break;
            }
            out("utsushi [snap]");
            break;
          }
          case "keshiki": {
            const kesh = kernel.keshiki;
            if (!kesh) throw new Error("ENOSYS");
            const sub = rest[0] || "";
            if (!sub || sub === "stat") {
              out(kesh.procText());
              break;
            }
            if (sub === "clear" || sub === "\u6255\u3046") {
              await kesh.clear();
              out(kesh.procText());
              break;
            }
            if (sub === "last" || sub === "\u6577\u304f" || sub === "\u5199\u3057") {
              const hit = await kesh.fromLast();
              out(hit.path);
              break;
            }
            if (sub === "set" || sub === "scale") {
              if (sub === "scale") {
                await kesh.setScale(rest[1]);
                out(kesh.procText());
                break;
              }
              const dest = resolve(rest[1] || "");
              if (!rest[1]) throw new Error("EINVAL");
              const hit = await kesh.set(dest);
              out(hit.path);
              break;
            }
            out("keshiki [set|clear|last|scale]");
            break;
          }
          case "sweep": {
            const u = kernel.utsuwa;
            if (!u || !u.sweep) throw new Error("ENOSYS");
            const hit = await u.sweep({ hard: rest[0] === "hard" });
            out(`dropped=${hit.dropped} bytes=${hit.bytes}`);
            break;
          }
          case "okoshi": {
            const o = kernel.okoshi;
            if (!o) throw new Error("ENOSYS");
            const sub = rest[0] || "";
            if (!sub || sub === "list" || sub === "stat") {
              out(o.procText());
              break;
            }
            if (sub === "add") {
              const id = rest[1] || "";
              if (!id) throw new Error("EINVAL");
              await o.add(id);
              out(o.procText());
              break;
            }
            if (sub === "rm") {
              const id = rest[1] || "";
              if (!id) throw new Error("EINVAL");
              await o.rm(id);
              out(o.procText());
              break;
            }
            out("okoshi [add|rm|list]");
            break;
          }
          case "share": {
            let to = "";
            const args = rest.slice();
            if (args[0] === "-a" || args[0] === "--to") {
              to = args[1] || "";
              args.splice(0, 2);
            }
            const dest = resolve(args[0] || "");
            if (!args[0]) throw new Error("EINVAL");
            await sharePath(dest, to ? { to } : {});
            out(to ? `share -a ${to} ${dest}` : `share ${dest}`);
            break;
          }
          case "env":
            out(
              Object.entries(kernel.state.env || {})
                .map(([k, v]) => `${k}=${v}`)
                .join("\n") || "（空）"
            );
            break;
          case "export": {
            const eq = restText.indexOf("=");
            if (eq < 0) throw new Error("EINVAL");
            kernel.setEnv(restText.slice(0, eq).trim(), restText.slice(eq + 1).trim());
            out("ok");
            break;
          }
          case "unset":
            kernel.unsetEnv(rest[0]);
            out("ok");
            break;
          case "ln": {
            const dest = resolve(rest[1]);
            await kernel.vfs.link(resolve(rest[0]), dest);
            kernel.noteRecent(dest);
            out(`ln ${resolve(rest[0])} -> ${dest}`);
            kernel.emit("vfs");
            break;
          }
          case "touch": {
            const path = resolve(rest[0]);
            await kernel.vfs.touch(path);
            kernel.noteRecent(path);
            out(path);
            kernel.emit("vfs");
            break;
          }
          case "hold": {
            const kami = kernel.holdKami(rest[0]);
            out(`SEASON_HOLD ${kami.name} pid=${kami.pid}`);
            break;
          }
          case "wake": {
            const kami = kernel.wakeKami(rest[0]);
            out(`running ${kami.name} pid=${kami.pid}`);
            break;
          }
          case "nice": {
            const kami = kernel.niceKami(rest[0], rest[1] || "1");
            out(`cpu=${kami.cpu} ${kami.name}`);
            break;
          }
          case "kill": {
            let sig = "TERM";
            let q = rest[0];
            if (q && q.startsWith("-")) {
              sig = q.slice(1).toUpperCase();
              q = rest[1];
            }
            const app = kernel.findApp(q);
            if (app && wm) {
              if (sig === "STOP") {
                wm.pause(app.pid);
                out(`STOP ${app.pid} ${app.appId}`);
              } else if (sig === "CONT") {
                wm.restore(app.pid);
                out(`CONT ${app.pid} ${app.appId}`);
              } else if (sig === "TERM" || sig === "KILL") {
                wm.close(app.pid);
                out(`TERM ${app.pid} ${app.appId}`);
              } else throw new Error("EINVAL");
              break;
            }
            out("EPERM \u795e\u306f\u6bba\u305b\u306a\u3044\u3002hold \u3067\u5b63\u7bc0\u306b\u9001\u308c\u3002");
            break;
          }
          case "which": {
            const name = rest[0] || "";
            const aliases = kernel.state.aliases || {};
            if (aliases[name]) out(`alias ${name}=${aliases[name]}`);
            else if (COMMANDS.includes(name)) out(`/bin/${name}`);
            else out("not found");
            break;
          }
          case "cron": {
            const sub = rest[0] || "";
            if (!sub || sub === "list") {
              const rows = (kernel.cronList && kernel.cronList()) || [];
              out(
                rows
                  .map((j) =>
                    j.every
                      ? `${j.id}  every ${j.every}s  ${j.kind}  ${j.payload}`
                      : `${j.id}  at ${j.at}  ${j.kind}  ${j.payload}`
                  )
                  .join("\n") || "empty"
              );
              break;
            }
            if (sub === "rm") {
              out(`rm ${kernel.cronRm(rest[1])}`);
              break;
            }
            if (sub === "every") {
              const sec = Number(rest[1]);
              if (!sec) throw new Error("EINVAL");
              const spec = kernel.cronParseKind(rest.slice(2));
              const rec = kernel.cronAdd({ every: sec, ...spec });
              out(`ok ${rec.id} every ${rec.every}s`);
              break;
            }
            if (sub === "at") {
              const wait = kernel.cronParseWait(rest[1]);
              if (!wait) throw new Error("EINVAL");
              const spec = kernel.cronParseKind(rest.slice(2));
              const rec = kernel.cronAdd({ wait, ...spec });
              out(`ok ${rec.id} at +${wait}s`);
              break;
            }
            throw new Error("EINVAL");
          }
          case "at": {
            const wait = kernel.cronParseWait(rest[0]);
            if (!wait) throw new Error("EINVAL");
            const spec = kernel.cronParseKind(rest.slice(1));
            const rec = kernel.cronAdd({ wait, ...spec });
            out(`ok ${rec.id} at +${wait}s`);
            break;
          }
          case "atq": {
            const rows = ((kernel.cronList && kernel.cronList()) || []).filter((j) => !j.every);
            out(rows.map((j) => `${j.id}  ${j.payload}`).join("\n") || "empty");
            break;
          }
          case "atrm":
            out(`rm ${kernel.cronRm(rest[0])}`);
            break;
          case "alias": {
            if (!rest[0]) {
              out(
                Object.entries(kernel.state.aliases || {})
                  .map(([k, v]) => `${k}=${v}`)
                  .join("\n") || "（空）"
              );
              break;
            }
            const eq = restText.indexOf("=");
            if (eq < 0) {
              out((kernel.state.aliases || {})[rest[0]] || "（なし）");
              break;
            }
            kernel.setAlias(restText.slice(0, eq).trim(), restText.slice(eq + 1).trim());
            out("ok");
            break;
          }
          default:
            if (a.startsWith("./") || a.startsWith("/")) {
              const path = resolve(a);
              const f = await kernel.vfs.read(path);
              if (!f.exec) throw new Error("EPERM");
              await runScript(f.body);
            } else {
              out(`command not found: ${a}\n言霊が足りない。help を見よ。`);
            }
        }
    }

    out(`八百万OS 奉納シェル。${kernel.state.ujiko} として接続。help / kashiwa / oncall / ps`);
    if (offer) out(`offer ${offer.path || offer.text || ""}`);
    (async () => {
      try {
        const rc = `/home/${kernel.state.ujiko}/.hounourc`;
        const f = await kernel.vfs.read(rc);
        const live = String(f.body || "")
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith("#"));
        if (!live.length) return;
        out("# .hounourc");
        await runScript(f.body);
      } catch (err) {
        /* 札が無い日もある */
      }
    })();
    function applySearch() {
      const hist = historyList();
      searchHits = hist.filter((h) => h.includes(searchQ));
      searchI = searchHits.length ? searchHits.length - 1 : -1;
      input.value = searchI >= 0 ? searchHits[searchI] : "";
      ps.textContent = searchQ ? `探る ${searchQ} $` : "探る $";
    }

    input.addEventListener("keydown", (e) => {
      if (e.ctrlKey && (e.key === "r" || e.key === "R")) {
        e.preventDefault();
        if (!searchMode) {
          searchMode = true;
          searchQ = "";
          draft = input.value;
          applySearch();
        } else if (searchHits.length) {
          searchI = (searchI - 1 + searchHits.length) % searchHits.length;
          input.value = searchHits[searchI];
        }
        return;
      }
      if (searchMode) {
        if (e.key === "Escape") {
          e.preventDefault();
          searchMode = false;
          searchQ = "";
          input.value = draft;
          syncChrome();
          return;
        }
        if (e.key === "Enter") {
          searchMode = false;
          searchQ = "";
          syncChrome();
          handle(input.value);
          input.value = "";
          return;
        }
        if (e.key === "Backspace") {
          e.preventDefault();
          searchQ = searchQ.slice(0, -1);
          applySearch();
          return;
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          searchQ += e.key;
          applySearch();
          return;
        }
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "l" || e.key === "L") && !searchMode) {
        e.preventDefault();
        outEl.textContent = "";
        return;
      }
      if (e.key === "Enter") {
        handle(input.value);
        input.value = "";
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        complete();
        return;
      }
      const hist = historyList();
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!hist.length) return;
        if (histCursor < 0) draft = input.value;
        histCursor = histCursor < 0 ? hist.length - 1 : Math.max(0, histCursor - 1);
        input.value = hist[histCursor];
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (histCursor < 0) return;
        histCursor += 1;
        if (histCursor >= hist.length) {
          histCursor = -1;
          input.value = draft;
        } else {
          input.value = hist[histCursor];
        }
      }
    });
    syncChrome();
    return {
      el,
      title: "hounou.sh",
      onFocus() {
        input.focus();
      },
      onDrop(paths) {
        const add = (paths || []).filter(Boolean).join(" ");
        if (!add) return;
        input.value = input.value ? `${input.value.replace(/\s+$/, "")} ${add}` : add;
        input.focus();
      },
      onOffer(next) {
        if (!next) return;
        out(`offer ${next.path || next.text || ""}`);
      },
    };
  },
};
