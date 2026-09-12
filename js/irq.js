const KINDS = [
  { kind: "muen", w: 40 },
  { kind: "swap", w: 28 },
  { kind: "fw", w: 24 },
  { kind: "sengu", w: 8 },
];

function pickKind(avoid) {
  const pool = avoid ? KINDS.filter((k) => k.kind !== avoid) : KINDS;
  const use = pool.length ? pool : KINDS;
  const total = use.reduce((a, k) => a + k.w, 0);
  let r = Math.random() * total;
  for (const k of use) {
    r -= k.w;
    if (r <= 0) return k.kind;
  }
  return use[0].kind;
}

export function startIrq(layer, kernel, field, launch) {
  let busy = false;
  let timer = null;
  let lastKind = "";

  function copy(kind) {
    return (window.YAOYOROZU_IRQ && window.YAOYOROZU_IRQ[kind]) || { title: kind, body: "" };
  }

  function clear() {
    layer.innerHTML = "";
    busy = false;
  }

  function card(kind) {
    if (busy || document.hidden || kernel.state.maLocked) return;
    busy = true;
    lastKind = kind;
    const c = copy(kind);
    const box = document.createElement("aside");
    box.className = "irq-card";
    box.innerHTML = `<h3>${c.title}</h3><p>${c.body}</p><div class="irq-actions"></div>`;
    const actions = box.querySelector(".irq-actions");

    if (kind === "muen") {
      const packet = kernel.spawnMuen();
      if (field) field.spawnMuen(packet);
      const name = document.createElement("button");
      name.className = "btn primary";
      name.textContent = "名を付ける";
      name.onclick = () => {
        const n = window.prompt("この点の名", "通りすがりの縁");
        if (n) kernel.nameMuen(packet.id, n);
        clear();
      };
      const leave = document.createElement("button");
      leave.className = "btn";
      leave.textContent = "放置する";
      leave.onclick = () => clear();
      actions.append(name, leave);
    } else if (kind === "swap") {
      const back = document.createElement("button");
      back.className = "btn primary";
      back.textContent = "差し戻す";
      back.onclick = () => {
        kernel.denySwap();
        launch("map");
        clear();
      };
      const skip = document.createElement("button");
      skip.className = "btn";
      skip.textContent = "見送る";
      skip.onclick = () => clear();
      actions.append(back, skip);
    } else if (kind === "fw") {
      kernel.log("注連縄: 公開要求を deny", "fw");
      const ok = document.createElement("button");
      ok.className = "btn primary";
      ok.textContent = "確認";
      ok.onclick = () => {
        launch("fw");
        clear();
      };
      actions.append(ok);
    } else {
      const frame = document.createElement("div");
      frame.className = "sengu-frame";
      layer.appendChild(frame);
      kernel.log("枠だけ遷宮した。中身は残る", "sengu");
      if (field) field.burst("hitodama", 18);
      setTimeout(clear, 2800);
    }

    if (kind !== "sengu") layer.appendChild(box);
    kernel.log(`irq ${kind}`, "irq");
    if (kernel.noteOshi) kernel.noteOshi(`割込 ${kind}`, "irq");
  }

  function loop() {
    const ms = kernel.state.settings.irqMs || 16000;
    const wait = busy ? ms : ms + Math.random() * 8000;
    timer = setTimeout(() => {
      if (document.hidden || kernel.state.maLocked || busy) {
        loop();
        return;
      }
      if (!kernel.state.settings.silent || Math.random() < 0.35) card(pickKind(lastKind));
      loop();
    }, wait);
  }

  kernel.addEventListener("irq", (ev) => {
    if (ev.detail && ev.detail.kind === "zashiki") {
      const c = document.createElement("aside");
      c.className = "irq-card";
      c.innerHTML = `<h3>座敷童</h3><p>空きプロセスを殺すな。この空間の最後の窓を、一度止めた。</p>`;
      layer.appendChild(c);
      if (kernel.noteOshi) kernel.noteOshi("座敷童が最後の窓を止めた", "irq");
      setTimeout(() => c.remove(), 3200);
    }
  });

  loop();
  return { card, clear };
}
