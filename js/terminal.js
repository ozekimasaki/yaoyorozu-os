(function () {
  const help = `八百万OS 奉納ターミナル
コマンド:
  help                 この文
  whoami               あなたもすでに誰かの神である
  ls kami              神プロセスを列挙
  ls pref              47カーネル
  cat constitution N   憲法第N条
  ping 縁              縁の疎通
  grep 無縁            障害系を探す
  migrate 東京         過密の再配置を試す
  hounou <text>        奉納する
  compile              国家をコンパイルする
  reboot               遷宮（再起動）
`;

  function out(el, text) {
    el.textContent += `${text}\n`;
    el.scrollTop = el.scrollHeight;
  }

  function handle(cmd, el) {
    const c = cmd.trim();
    if (!c) return;
    out(el, `神官 $ ${c}`);
    const [a, b, ...rest] = c.split(/\s+/);
    const restText = [b, ...rest].filter(Boolean).join(" ");
    switch (a) {
      case "help":
        out(el, help);
        break;
      case "whoami":
        out(el, "uid=八百万 gid=列島\nあなたは、誰かの日常を支えているなら、すでに神である。");
        break;
      case "ls":
        if (b === "kami") {
          out(
            el,
            window.YAOYOROZU_KAMI.map((k) => `${k.status.padEnd(10)} ${k.name}  # ${k.role}`).join("\n")
          );
        } else if (b === "pref") {
          out(el, window.YAOYOROZU_PREFECTURES.map((p) => `${p.name}  cpu_free=${p.unusedCpu}%`).join("\n"));
        } else {
          out(el, "kami  pref  constitution  protocols  manifesto");
        }
        break;
      case "cat":
        if (b === "constitution") {
          const n = Number(restText);
          const art = window.YAOYOROZU_CONSTITUTION.articles.find((x) => x.n === n);
          if (!art) out(el, "条文が見つからない。1-20。");
          else out(el, `第${art.n}条 ${art.title}\n${art.body}`);
        } else {
          out(el, window.YAOYOROZU_CONSTITUTION.preamble);
        }
        break;
      case "ping":
        out(el, `PING ${b || "縁"}: 64 bytes from 出雲: ttl=無限 time=${(Math.random() * 8 + 1).toFixed(2)} ms`);
        break;
      case "grep":
        if ((b || "").includes("無縁")) {
          out(el, "muen: 23.4%  # 自己責任ではない。ネットワーク障害である。");
        } else {
          out(el, "一致なし。言葉がまだ神になっていない。");
        }
        break;
      case "migrate":
        out(el, "migrating 過密の龍 → 47 nodes\nTokyo load 88% → 61%\nlocal kami restored from swap.\n完了していない。それでよい。");
        break;
      case "hounou":
        if (!restText) out(el, "奉納が空です。少額でよい。透明であれ。");
        else out(el, `奉納を受け付けた: 「${restText}」\n行き先: 最寄りの小さな神へルーティング。国税のブラックホールには入れない。`);
        break;
      case "compile":
        out(
          el,
          [
            "kotodama-compiler 0.1",
            "inputs: 47 kernels, 80,431 shrines, leftover tokens",
            "optimizing: 季節 > 効率",
            "linking: 死者の席.o  余白.o  未完了.o",
            "warning: 一神教的単一障害点を検出。八百万へ分解。",
            "output: ./日本.elf",
            "exit 0  (未完了のまま成功)",
          ].join("\n")
        );
        break;
      case "reboot":
        out(el, "式年遷宮を前倒ししています。人は残し、権威のホコリは捨てます。");
        setTimeout(() => window.location.reload(), 600);
        break;
      case "clear":
        el.textContent = "";
        break;
      default:
        out(el, `command not found: ${a}\n言霊が足りない。help を見よ。`);
    }
  }

  window.YaoyorozuTerm = {
    start() {
      const el = document.getElementById("terminal-out");
      const input = document.getElementById("term-input");
      out(el, "八百万OS 奉納ターミナル。help でコマンド一覧。神はマイクロサービスである。");
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          handle(input.value, el);
          input.value = "";
        }
      });
    },
  };
})();
