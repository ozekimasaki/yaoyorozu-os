import { openPath } from "../runtime.js";

const HELP = `八百万OS 奉納シェル
  help                 この文
  whoami / 名簿        氏子
  oncall               今日の当直
  ps                   神プロセス
  ls [-l] [path]       縁fs
  cat <path>           読む
  write <path> <text>  書く
  mkdir <path>         匣を作る
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
  cd [path]            匣を移る
  pwd                  今の匣
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
  "logout",
  "reboot",
  "clear",
];

export default {
  id: "term",
  title: "奉納",
  width: "min(720px, 84vw)",
  height: "min(520px, 70vh)",
  spawn({ kernel, launch }) {
    const el = document.createElement("div");
    el.innerHTML = `
      <div class="term-out" id="term-out"></div>
      <div class="term-row"><span>神官 $</span><input type="text" autocomplete="off" spellcheck="false" aria-label="奉納コマンド" /></div>
    `;
    const outEl = el.querySelector(".term-out");
    const input = el.querySelector("input");
    let cwd = `/home/${kernel.state.ujiko}`;
    let histCursor = -1;
    let draft = "";

    let sink = null;
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
      } else if (a === "wc") {
        sink.push(`${stdin.split("\n").length} ${stdin.split(/\s+/).filter(Boolean).length} ${stdin.length}`);
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
          case "ps":
            out(
              kernel.state.processes
                .filter((p) => p.kind !== "app")
                .slice(0, 40)
                .map((p) => `${String(p.pid).padStart(4)} ${p.status.padEnd(10)} ${p.name}`)
                .join("\n")
            );
            break;
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
          case "df": {
            const u = await kernel.vfs.usage("/");
            out(`縁fs  files=${u.files} dirs=${u.dirs} bytes=${u.bytes}`);
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
            const m = restText.match(/^(.*)>\s*(\S+)\s*$/);
            if (m) {
              const path = resolve(m[2]);
              await kernel.vfs.write(path, m[1].trim());
              kernel.noteRecent(path);
              out(path);
              kernel.emit("vfs");
            } else {
              out(restText);
            }
            break;
          }
          case "head":
          case "tail": {
            const f = await kernel.readPath(resolve(rest[0]));
            const lines = f.body.split("\n");
            const slice = a === "head" ? lines.slice(0, 12) : lines.slice(-12);
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
            out(`silent=${s.silent} irq.ms=${s.irqMs} sound=${s.sound}`);
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
            out(cwd);
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
            const id = rest[0];
            if (!id) throw new Error("EINVAL");
            if (id.startsWith("/") || id.startsWith("./") || id.includes(".")) openPath(resolve(id));
            else launch(id);
            out(`open ${id}`);
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
          case "kill":
            out("EPERM 神は殺せない。hold で季節に送れ。");
            break;
          case "which": {
            const name = rest[0] || "";
            const aliases = kernel.state.aliases || {};
            if (aliases[name]) out(`alias ${name}=${aliases[name]}`);
            else if (COMMANDS.includes(name)) out(`/bin/${name}`);
            else out("not found");
            break;
          }
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
    input.addEventListener("keydown", (e) => {
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
    return {
      el,
      title: "hounou.sh",
      onFocus() {
        input.focus();
      },
    };
  },
};
