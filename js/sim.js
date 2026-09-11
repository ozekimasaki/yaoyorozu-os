(function () {
  const state = {
    day: 0,
    gep: 0,
    muen: 23.4,
    tokyo: 88,
    local: 41,
    running: false,
    logs: [],
  };

  function sumEn() {
    return window.YAOYOROZU_PREFECTURES.reduce((a, p) => a + p.en, 0);
  }

  function line(msg) {
    const t = `D${String(state.day).padStart(4, "0")}  ${msg}`;
    state.logs.push(t);
    if (state.logs.length > 24) state.logs.shift();
  }

  function eventsForDay() {
    const p =
      window.YAOYOROZU_PREFECTURES[
        Math.floor(Math.random() * window.YAOYOROZU_PREFECTURES.length)
      ];
    const roll = Math.random();
    if (state.day === 1) {
      line("47カーネルの疎通確認。余っている神の申告を開始。");
      return;
    }
    if (state.day === 100) line("奉納税パイロット。行き先が見える税が、島根と鳥取で通った。");
    if (state.day === 365) line("無縁スキャン全国試験。名前を呼ばれなかった人が、一度だけ呼ばれる。");
    if (state.day === 1000) line("最初の遷宮。うまくいかない制度を、祭とともに解体する。");
    if (roll < 0.18) {
      line(`${p.name}: 祭が同期した。GEP +${(p.en * 0.01).toFixed(0)}`);
      state.gep += p.en * 0.01;
      state.muen = Math.max(4, state.muen - 0.15);
      state.local = Math.min(92, state.local + 0.2);
    } else if (roll < 0.3) {
      line(`${p.name}: 無縁パケット検知。最小接続を提案（強制友情はしない）。`);
      state.muen = Math.max(4, state.muen - 0.08);
    } else if (roll < 0.4) {
      line("東京: 過密の龍が地方神をスワップアウトしようとした。ルーティングで差し戻し。");
      state.tokyo = Math.max(40, state.tokyo - 0.4);
    } else if (roll < 0.48) {
      line(`${p.name}: ${p.season}の法が、急ぎの会議を遅延させた。効率は季節の下位互換。`);
      state.gep += 40;
    } else if (roll < 0.55) {
      line("言霊コンパイラ: 空のスローガンを弾いた。約束だけが実行文になる。");
    } else if (roll < 0.62) {
      line(`${p.name}: 未使用CPU ${p.unusedCpu}% を余白として輸出。過疎はバグではない。`);
      state.local = Math.min(92, state.local + 0.15);
    } else if (roll < 0.7) {
      line("注連縄FW: 子どもと死者のデータを既定deny。公開要求を儀礼キューへ。");
    } else {
      line(`${p.name}: 日常が動いている。${p.kami}`);
      state.gep += 12;
    }
    if (state.day % 20 === 0) {
      state.tokyo = Math.min(96, state.tokyo + 0.3);
    }
  }

  function render() {
    document.getElementById("stat-day").textContent = String(state.day);
    document.getElementById("stat-gep").textContent = Math.floor(state.gep).toLocaleString("ja-JP");
    document.getElementById("stat-muen").textContent = `${state.muen.toFixed(1)}%`;
    document.getElementById("stat-local").textContent = `${state.local.toFixed(0)}%`;
    document.getElementById("sim-log").textContent = state.logs.join("\n");
  }

  function step() {
    state.day += 1;
    eventsForDay();
    render();
    if (state.day >= 1000) {
      state.running = false;
      line("1000日が満ちた。憲法第20条により、このシミュレータ自体を建て直せ。");
      render();
    }
  }

  function play() {
    if (state.running) return;
    state.running = true;
    const iv = setInterval(() => {
      if (!state.running || state.day >= 1000) {
        clearInterval(iv);
        state.running = false;
        return;
      }
      step();
    }, 80);
  }

  window.YaoyorozuSim = {
    start() {
      state.gep = sumEn() * 0.001;
      line("シミュレータ接続。Gross En Product の計測を開始する。");
      render();
      document.getElementById("sim-play").addEventListener("click", play);
      document.getElementById("sim-step").addEventListener("click", () => {
        if (state.day < 1000) step();
      });
      document.getElementById("sim-reset").addEventListener("click", () => {
        state.day = 0;
        state.gep = sumEn() * 0.001;
        state.muen = 23.4;
        state.tokyo = 88;
        state.local = 41;
        state.running = false;
        state.logs = [];
        line("再起動。未完了は消えない。ログだけが清まる。");
        render();
      });
    },
  };
})();
