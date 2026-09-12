const MAX_BODY = 196608;
const CHUNK = 12000;
const RTC_CFG = {
  iceServers: [
    { urls: "stun:stun.cloudflare.com:3478" },
    { urls: "stun:stun.l.google.com:19302" },
  ],
};

function supported() {
  return typeof RTCPeerConnection === "function";
}

function hexId(n = 8) {
  let s = "";
  while (s.length < n) s += Math.random().toString(16).slice(2);
  return s.slice(0, n);
}

function kotobaOf(raw) {
  const s = String(raw || "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 32);
  return s || `en-${hexId(6)}`;
}

function safeName(name) {
  const s = String(name || "ofuda")
    .replace(/[\\/]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 64);
  return s || "ofuda";
}

function waitGather(pc) {
  if (!pc || pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const t = setTimeout(resolve, 4500);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(t);
        resolve();
      }
    };
  });
}

export function attachWatari(kernel) {
  if (!kernel || kernel.watari) return kernel.watari;
  const vfs = kernel.vfs;
  const myId = kernel.tabId || `tab-${hexId(8)}`;
  const rec = {
    via: "",
    kotoba: "",
    role: "",
    status: "still",
    peer: "",
    lastErr: "",
    sent: 0,
    recv: 0,
    offer: "",
    answer: "",
  };
  let pc = null;
  let dc = null;
  let loopHold = null;
  let offered = false;
  const sinks = [];
  const stops = [];
  const parts = new Map();
  const iceBuf = [];

  function ujiko() {
    return (kernel.state && kernel.state.ujiko) || "ujiko";
  }

  function markDom() {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.watari = supported() ? rec.status || "still" : "0";
    const pill = document.getElementById("watari-pill");
    if (!pill) return;
    const show = rec.status === "live" || rec.status === "calling";
    pill.hidden = !show;
    pill.classList.toggle("is-live", rec.status === "live");
    const label =
      rec.status === "live"
        ? `\u6e21\u308a  ${rec.peer || rec.kotoba || ""}`.trim()
        : rec.status === "calling"
          ? "\u6e21\u308a  \u62db\u304f"
          : "\u6e21\u308a";
    if (pill.textContent !== label) pill.textContent = label;
  }

  function emit() {
    markDom();
    kernel.emit("watari", { ...rec });
  }

  function procText() {
    return [
      `supported=${supported() ? 1 : 0}`,
      `state=${rec.status || "still"}`,
      `via=${rec.via || ""}`,
      `kotoba=${rec.kotoba || ""}`,
      `role=${rec.role || ""}`,
      `peer=${rec.peer || ""}`,
      `sent=${rec.sent || 0}`,
      `recv=${rec.recv || 0}`,
      rec.lastErr ? `err=${rec.lastErr}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  function fan(msg) {
    const body = { ...msg, id: myId };
    for (const send of sinks) {
      try {
        send(body);
      } catch (err) {
        /* sink */
      }
    }
  }

  async function ensureInbox() {
    await vfs.mkdir("/var/watari");
  }

  async function seed() {
    await ensureInbox();
    const home = kernel.state && kernel.state.ujiko ? `/home/${kernel.state.ujiko}` : "";
    if (home) {
      const gate = `${home}/desktop/\u6e21\u308a.gate`;
      if (!(await vfs.getFile(gate))) await vfs.write(gate, "watari", "gate/app");
    }
    const note = "/var/watari/\u6e21\u308a.txt";
    if (!(await vfs.getFile(note))) {
      await vfs.write(
        note,
        [
          "\u6e21\u308a\u306f\u3001\u6c0f\u5b50\u3068\u6c0f\u5b50\u306e\u821f\u3067\u3042\u308b\u3002",
          "\u793e\uff08\u540c\u3058\u9ce5\u5c45\u306e\u5e2d\uff09\u3001\u9060\u7e01\uff08\u5408\u8a00\u8449\uff09\u3001\u672d\uff08\u62db\u304d\u3092\u5199\u3059\uff09\u3067\u7d50\u3076\u3002",
          "\u53d7\u3051\u305f\u672d\u306f /var/watari \u3078\u5c4a\u304f\u3002\u81ea\u52d5\u3067\u306f\u5949\u7d0d\u3057\u306a\u3044\u3002",
          "",
        ].join("\n"),
        "text/plain"
      );
    }
  }

  function wireChan(chan) {
    dc = chan;
    dc.binaryType = "arraybuffer";
    dc.onopen = () => {
      rec.status = "live";
      rec.lastErr = "";
      emit();
    };
    dc.onclose = () => {
      if (rec.status === "live") rec.status = "ma";
      emit();
    };
    dc.onerror = () => {
      rec.lastErr = "EPIPE";
      emit();
    };
    dc.onmessage = (ev) => {
      onChan(typeof ev.data === "string" ? ev.data : "");
    };
    if (dc.readyState === "open") {
      rec.status = "live";
      emit();
    }
  }

  function makePc(host) {
    pc = new RTCPeerConnection(RTC_CFG);
    pc.onicecandidate = (ev) => {
      if (ev.candidate) fan({ t: "ice", cand: ev.candidate.toJSON(), ujiko: ujiko() });
    };
    pc.ondatachannel = (ev) => wireChan(ev.channel);
    pc.onconnectionstatechange = () => {
      const st = pc && pc.connectionState;
      if (st === "failed") {
        rec.lastErr = "ECONNREFUSED";
        rec.status = rec.status === "live" ? "ma" : rec.status;
        emit();
      }
    };
    if (host) wireChan(pc.createDataChannel("watari", { ordered: true }));
  }

  async function makeOffer() {
    if (!pc || offered) return;
    offered = true;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    rec.offer = pc.localDescription ? pc.localDescription.sdp || "" : offer.sdp || "";
    fan({ t: "sdp", role: "offer", sdp: rec.offer, ujiko: ujiko() });
    emit();
  }

  async function flushIce() {
    if (!pc || !pc.remoteDescription) return;
    while (iceBuf.length) {
      const cand = iceBuf.shift();
      try {
        await pc.addIceCandidate(cand);
      } catch (err) {
        /* late ice */
      }
    }
  }

  async function takeSdp(sdp, role) {
    if (!pc || !sdp) return;
    if (role === "offer") {
      if (pc.remoteDescription) {
        if (rec.answer) fan({ t: "sdp", role: "answer", sdp: rec.answer, ujiko: ujiko() });
        return;
      }
      await pc.setRemoteDescription({ type: "offer", sdp });
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      rec.answer = pc.localDescription ? pc.localDescription.sdp || "" : answer.sdp || "";
      fan({ t: "sdp", role: "answer", sdp: rec.answer, ujiko: ujiko() });
      emit();
      return;
    }
    if (role === "answer" && pc.signalingState === "have-local-offer") {
      await pc.setRemoteDescription({ type: "answer", sdp });
      rec.answer = sdp;
      await flushIce();
      emit();
    }
  }

  async function onSignal(msg) {
    if (!msg || msg.id === myId) return;
    rec.peer = msg.ujiko || msg.id || rec.peer;
    switch (msg.t) {
      case "hi":
        rec.peer = msg.ujiko || msg.id || rec.peer;
        if (rec.role === "host") {
          if (!offered) await makeOffer();
          else if (rec.offer) fan({ t: "sdp", role: "offer", sdp: rec.offer, ujiko: ujiko() });
        }
        emit();
        break;
      case "sdp":
        try {
          await takeSdp(msg.sdp, msg.role);
        } catch (err) {
          rec.lastErr = err.message || "EINVAL";
          emit();
        }
        break;
      case "ice":
        if (msg.cand) {
          if (!pc || !pc.remoteDescription) iceBuf.push(msg.cand);
          else {
            try {
              await pc.addIceCandidate(msg.cand);
            } catch (err) {
              /* late ice */
            }
          }
        }
        break;
      case "bye":
        rec.peer = "";
        emit();
        break;
      default:
        break;
    }
  }

  function startShrine(kotoba) {
    if (typeof BroadcastChannel !== "function") return () => {};
    const ch = new BroadcastChannel(`yaoyorozu-watari:${kotoba}`);
    ch.onmessage = (ev) => onSignal(ev.data);
    sinks.push((msg) => ch.postMessage(msg));
    rec.via = rec.via || "shrine";
    return () => {
      try {
        ch.close();
      } catch (err) {
        /* closed */
      }
    };
  }

  function startWs(kotoba) {
    if (typeof WebSocket !== "function" || typeof location === "undefined") return () => {};
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    let ws;
    try {
      ws = new WebSocket(`${proto}//${location.host}/watari?k=${encodeURIComponent(kotoba)}&id=${encodeURIComponent(myId)}`);
    } catch (err) {
      return () => {};
    }
    ws.onmessage = (ev) => {
      try {
        onSignal(JSON.parse(String(ev.data || "")));
      } catch (err) {
        /* bad */
      }
    };
    ws.onopen = () => {
      rec.via = "kotoba";
      try {
        ws.send(JSON.stringify({ t: "hi", id: myId, ujiko: ujiko() }));
      } catch (err) {
        /* */
      }
      emit();
    };
    sinks.push((msg) => {
      if (ws.readyState === 1) ws.send(JSON.stringify(msg));
    });
    return () => {
      try {
        ws.close();
      } catch (err) {
        /* */
      }
    };
  }

  function clearSinks() {
    sinks.length = 0;
    while (stops.length) {
      const fn = stops.pop();
      try {
        fn();
      } catch (err) {
        /* */
      }
    }
  }

  async function teardownPc() {
    if (loopHold) {
      try {
        loopHold.a.close();
        loopHold.b.close();
      } catch (err) {
        /* */
      }
      loopHold = null;
    }
    if (dc) {
      try {
        dc.close();
      } catch (err) {
        /* */
      }
    }
    if (pc) {
      try {
        pc.close();
      } catch (err) {
        /* */
      }
    }
    dc = null;
    pc = null;
    offered = false;
    iceBuf.length = 0;
    rec.offer = "";
    rec.answer = "";
  }

  async function endLinks() {
    try {
      fan({ t: "bye", ujiko: ujiko() });
    } catch (err) {
      /* */
    }
    clearSinks();
    await teardownPc();
  }

  async function closeAll() {
    await endLinks();
    rec.status = "still";
    rec.via = "";
    rec.role = "";
    rec.peer = "";
    rec.lastErr = "";
    emit();
  }

  function pulseHi() {
    let n = 0;
    fan({ t: "hi", ujiko: ujiko() });
    const pulse = setInterval(() => {
      n += 1;
      if (rec.status === "live" || n > 16) {
        clearInterval(pulse);
        return;
      }
      fan({ t: "hi", ujiko: ujiko() });
    }, 320);
    stops.push(() => clearInterval(pulse));
  }

  function attachSignals(via, kotoba) {
    if (via === "shrine" || via === "kotoba") stops.push(startShrine(kotoba));
    if (via === "kotoba") stops.push(startWs(kotoba));
  }

  async function open(opts = {}) {
    if (!supported()) throw new Error("ENOSYS");
    await endLinks();
    const via = opts.via || "shrine";
    const kotoba = kotobaOf(opts.kotoba);
    rec.via = via;
    rec.kotoba = kotoba;
    rec.role = "host";
    rec.status = "calling";
    rec.peer = "";
    rec.lastErr = "";
    offered = false;
    makePc(true);
    if (via === "ofuda") {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitGather(pc);
      rec.offer = pc.localDescription.sdp || "";
      emit();
      return { ...rec };
    }
    attachSignals(via, kotoba);
    pulseHi();
    emit();
    return { ...rec };
  }

  async function join(opts = {}) {
    if (!supported()) throw new Error("ENOSYS");
    await endLinks();
    const via = opts.via || "shrine";
    const kotoba = kotobaOf(opts.kotoba);
    rec.via = via;
    rec.kotoba = kotoba;
    rec.role = "guest";
    rec.status = "calling";
    rec.peer = "";
    rec.lastErr = "";
    offered = false;
    makePc(false);
    if (via === "ofuda") {
      emit();
      return { ...rec };
    }
    attachSignals(via, kotoba);
    pulseHi();
    emit();
    return { ...rec };
  }

  async function acceptOffer(sdp) {
    if (!pc) await join({ via: "ofuda", kotoba: rec.kotoba || "ofuda" });
    await takeSdp(sdp, "offer");
    await waitGather(pc);
    rec.answer = pc.localDescription ? pc.localDescription.sdp || "" : rec.answer;
    emit();
    return rec.answer;
  }

  async function acceptAnswer(sdp) {
    if (!pc) throw new Error("ENOTCONN");
    await takeSdp(sdp, "answer");
    emit();
    return rec.answer;
  }

  function sendRaw(obj) {
    if (!dc || dc.readyState !== "open") throw new Error("ENOTCONN");
    const raw = JSON.stringify(obj);
    if (raw.length > MAX_BODY + 2048) throw new Error("ENOSPC");
    if (raw.length <= CHUNK) {
      dc.send(JSON.stringify({ v: 1, kind: "one", payload: obj }));
      return;
    }
    const id = hexId(10);
    const n = Math.ceil(raw.length / CHUNK);
    for (let i = 0; i < n; i += 1) {
      dc.send(JSON.stringify({ v: 1, kind: "part", id, i, n, data: raw.slice(i * CHUNK, (i + 1) * CHUNK) }));
    }
  }

  async function ingest(obj) {
    if (!obj || typeof obj !== "object") return;
    const name = safeName(obj.name || (obj.kind === "text" ? "note.ofuda" : "gift.ofuda"));
    const body = String(obj.body || "");
    const mime = obj.mime || "text/plain";
    const from = safeName(obj.from || rec.peer || "peer");
    await ensureInbox();
    const dest = `/var/watari/${from}-${name}`;
    await vfs.write(dest, body, mime);
    rec.recv += 1;
    kernel.noteRecent(dest);
    if (kernel.noteJournal) kernel.noteJournal("watari", dest, { path: dest });
    if (kernel.noteOshi) kernel.noteOshi(`\u6e21\u308a ${from} ${name}`, "watari");
    kernel.emit("watari-recv", { path: dest, from, name });
    kernel.emit("vfs");
    emit();
    return dest;
  }

  function takePayload(obj) {
    ingest(obj).catch((err) => {
      rec.lastErr = err.message || "EIO";
      emit();
    });
  }

  function onChan(raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw || ""));
    } catch (err) {
      return;
    }
    if (!msg || msg.v !== 1) return;
    switch (msg.kind) {
      case "one":
        takePayload(msg.payload);
        break;
      case "part": {
        const id = String(msg.id || "");
        if (!id) return;
        if (!parts.has(id)) parts.set(id, { n: msg.n || 0, got: [] });
        const slot = parts.get(id);
        slot.got[msg.i | 0] = String(msg.data || "");
        if (slot.got.filter((x) => x != null).length >= (slot.n || msg.n)) {
          parts.delete(id);
          try {
            takePayload(JSON.parse(slot.got.join("")));
          } catch (err) {
            rec.lastErr = "EINVAL";
            emit();
          }
        }
        break;
      }
      case "ofuda":
      case "text":
        takePayload(msg);
        break;
      default:
        break;
    }
  }

  async function sendPath(path) {
    const f = await vfs.read(path);
    if (f.type === "dir") throw new Error("EISDIR");
    const body = String(f.body || "");
    if (body.length > MAX_BODY) throw new Error("ENOSPC");
    sendRaw({
      kind: "ofuda",
      name: vfs.nameOf(path),
      path,
      mime: f.mime || "text/plain",
      body,
      from: ujiko(),
      at: Date.now(),
    });
    rec.sent += 1;
    if (kernel.noteJournal) kernel.noteJournal("watari", path, { path });
    emit();
    return path;
  }

  async function sendText(text) {
    const body = String(text || "");
    if (!body) throw new Error("EINVAL");
    if (body.length > MAX_BODY) throw new Error("ENOSPC");
    sendRaw({
      kind: "text",
      name: "note.ofuda",
      mime: "text/plain",
      body,
      from: ujiko(),
      at: Date.now(),
    });
    rec.sent += 1;
    emit();
    return body.length;
  }

  function waitLive(ms = 8000) {
    if (rec.status === "live") return Promise.resolve(true);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("ETIMEDOUT")), ms);
      function on() {
        if (rec.status === "live") {
          kernel.removeEventListener("watari", on);
          clearTimeout(t);
          resolve(true);
        }
      }
      kernel.addEventListener("watari", on);
    });
  }

  async function bindLoop() {
    if (!supported()) throw new Error("ENOSYS");
    await endLinks();
    const a = new RTCPeerConnection(RTC_CFG);
    const b = new RTCPeerConnection(RTC_CFG);
    a.onicecandidate = (ev) => {
      if (ev.candidate) b.addIceCandidate(ev.candidate);
    };
    b.onicecandidate = (ev) => {
      if (ev.candidate) a.addIceCandidate(ev.candidate);
    };
    const recvReady = new Promise((resolve) => {
      b.ondatachannel = (ev) => {
        ev.channel.onmessage = (e) => onChan(typeof e.data === "string" ? e.data : "");
        ev.channel.onopen = resolve;
        if (ev.channel.readyState === "open") resolve();
      };
    });
    const local = a.createDataChannel("watari", { ordered: true });
    const offer = await a.createOffer();
    await a.setLocalDescription(offer);
    await b.setRemoteDescription(offer);
    const answer = await b.createAnswer();
    await b.setLocalDescription(answer);
    await a.setRemoteDescription(answer);
    loopHold = { a, b };
    pc = a;
    dc = local;
    rec.via = "loop";
    rec.role = "host";
    rec.kotoba = "loop";
    rec.peer = ujiko();
    rec.status = "calling";
    emit();
    await Promise.all([
      new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("ETIMEDOUT")), 8000);
        const hit = () => {
          clearTimeout(t);
          resolve();
        };
        local.onopen = hit;
        if (local.readyState === "open") hit();
      }),
      recvReady,
    ]);
    rec.status = "live";
    emit();
    return { ...rec };
  }

  const ready = seed().catch(() => {});
  kernel.watari = {
    supported,
    procText,
    snapshot: () => ({ ...rec }),
    offerText: () => rec.offer,
    answerText: () => rec.answer,
    open,
    join,
    acceptOffer,
    acceptAnswer,
    sendPath,
    sendText,
    close: closeAll,
    bindLoop,
    waitLive,
    ready,
  };
  markDom();
  return kernel.watari;
}
