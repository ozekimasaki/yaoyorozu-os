const HELP = `八百万OS 奉納シェル
  help                 この文
  whoami / 名簿        氏子
  oncall               今日の当直
  ps                   神プロセス
  ls [path]            縁fs
  cat <path>           読む
  write <path> <text>  書く
  mkdir <path>         匣を作る
  mv <from> <to>       名を移す
  rm <path>            無縁へ送る
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
  "logout",
  "reboot",
  "clear",
];

export default {
  id: "term",
  title: "奉納",
  width: "min(720px, 84vw)",
  height: "min(520px, 70vh)",
  spawn({ kernel }) {
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

    function out(text) {
      outEl.textContent += `${text}\n`;
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

    async function handle(raw) {
      const line = raw.trim();
      if (!line) return;
      kernel.pushHistory(line);
      histCursor = -1;
      draft = "";
      out(`神官 $ ${line}`);
      const [a, ...rest] = line.split(/\s+/);
      const restText = rest.join(" ");
      try {
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
            const path = resolve(rest[0]);
            const rows = await kernel.vfs.ls(path);
            out(rows.map((f) => `${f.type === "dir" ? "d" : "-"} ${f.name}`).join("\n") || "（空）");
            break;
          }
          case "cat": {
            const f = await kernel.vfs.read(resolve(rest[0]));
            kernel.noteRecent(resolve(rest[0]));
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
          default:
            out(`command not found: ${a}\n言霊が足りない。help を見よ。`);
        }
      } catch (err) {
        out(err.message || String(err));
        if (err.message === "EPERM" && a !== "logout") kernel.emit("need-auth");
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
