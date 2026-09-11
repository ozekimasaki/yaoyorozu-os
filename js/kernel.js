import { bits16, hash32, hexFromHash, jstDateKey, mulberry32, pick } from "./rng.js";
import { createBus, tabId } from "./bus.js";
import { createVfs } from "./vfs.js";

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

const SHRINE_SUFFIX = ["神社", "社", "宮", "祠", "大社", "天満宮"];

const LOCKED_FW = [
  { id: "child", name: "子ども", action: "deny", locked: true, note: "保護ネットワーク。外せない。" },
  { id: "dead", name: "死者", action: "deny", locked: true, note: "死者の席は公開要求できない。" },
  { id: "illness", name: "病", action: "deny", locked: true, note: "病の記録は既定deny。" },
  { id: "fail", name: "失敗の記録", action: "deny", locked: true, note: "失敗を晒すな。" },
  { id: "pray", name: "祈り", action: "deny", locked: true, note: "祈りはログに残し、公開しない。" },
];

const SYSCALLS = ["ATTACHED", "EPERM", "ENOSPC", "ENOMEN", "SEASON_HOLD", "MIGRATE_QUEUED"];

function prefs() {
  return window.YAOYOROZU_PREFECTURES || [];
}

function authoredKami() {
  return (window.YAOYOROZU_KAMI || []).map((k) => ({ ...k, kind: "authored", pref: null }));
}

function hexId(n) {
  let s = "";
  while (s.length < n) s += Math.random().toString(16).slice(2);
  return s.slice(0, n);
}

function loadUjiko() {
  let id = "";
  try {
    id = localStorage.getItem("yaoyorozu.ujiko") || "";
  } catch (err) {
    id = "";
  }
  if (!id) {
    id = `氏-${hexId(6)}`;
    try {
      localStorage.setItem("yaoyorozu.ujiko", id);
    } catch (err) {
      /* private */
    }
  }
  return id;
}

function shrineQuotas(list) {
  const raw = list.map((p) => 420 + Math.round(p.en / 70) + Math.round(p.unusedCpu * 6));
  const sum = raw.reduce((a, b) => a + b, 0);
  const target = 80431;
  const scaled = raw.map((n) => Math.max(80, Math.round((n / sum) * target)));
  let drift = target - scaled.reduce((a, b) => a + b, 0);
  scaled[scaled.length - 1] += drift;
  const map = {};
  list.forEach((p, i) => {
    map[p.id] = scaled[i];
  });
  return map;
}

class Kernel extends EventTarget {
  constructor() {
    super();
    this.vfs = createVfs();
    this.tabId = tabId;
    this.worker = null;
    this.bus = null;
    this.ready = false;
    this.pidSeq = 80;
    this.state = null;
  }

  log(msg, tag = "kern") {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${tag}: ${msg}`;
    this.state.dmesg.push(line);
    if (this.state.dmesg.length > 240) this.state.dmesg.shift();
    this.emit("dmesg", line);
    return line;
  }

  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  nextPid() {
    this.pidSeq += 1;
    return this.pidSeq;
  }

  computeOncall() {
    const day = jstDateKey();
    const seed = hash32(`${this.state.ujiko}:${day}`);
    const rng = mulberry32(seed);
    const kamiPool = this.state.processes.filter((p) => p.kind !== "app");
    const kami = pick(rng, kamiPool) || { name: "竈神", id: "kamado", note: "火のある家は、まだ国家である。" };
    const pref = pick(rng, this.state.prefs) || prefs()[0];
    const article = 1 + ((rng() * 20) | 0);
    return {
      day,
      seed,
      entropy: hexFromHash(seed),
      bits: bits16(seed),
      kami,
      pref,
      article,
    };
  }

  generateKami(rng) {
    const extras = [];
    const list = prefs();
    for (let i = 0; i < 180; i += 1) {
      const t = pick(rng, KAMI_TEMPLATES);
      const pref = pick(rng, list);
      extras.push({
        id: `gen-${hexFromHash(hash32(`g:${i}:${t.role}`), 6)}`,
        name: `${pref.name}の${t.role}の神`,
        role: t.role,
        status: pick(rng, ["running", "running", "idle", "seasonal"]),
        cpu: 1 + ((rng() * 22) | 0),
        en: 8000 + ((rng() * 180000) | 0),
        note: t.note,
        kind: "generated",
        pref: pref.id,
        pid: 200 + i,
      });
    }
    return extras;
  }

  shrineName(pref, index) {
    const rng = mulberry32(hash32(`${pref.id}:shrine:${index}`));
    const suf = SHRINE_SUFFIX[(rng() * SHRINE_SUFFIX.length) | 0];
    return `${pref.name}${suf}・${String(index + 1).padStart(4, "0")}`;
  }

  listShrines(prefId, offset = 0, limit = 40) {
    const pref = this.state.prefs.find((p) => p.id === prefId);
    if (!pref) return { total: 0, rows: [] };
    const total = this.state.quotas[prefId] || 0;
    const rows = [];
    for (let i = offset; i < Math.min(offset + limit, total); i += 1) {
      rows.push({
        index: i,
        name: this.shrineName(pref, i),
        path: `/mnt/${pref.id}/shrines/${String(i).padStart(5, "0")}.ofuda`,
      });
    }
    return { total, rows };
  }

  async seedFs() {
    const home = `/home/${this.state.ujiko}`;
    const dirs = [
      "/",
      "/proc",
      "/proc/kami",
      "/proc/pref",
      "/etc",
      "/etc/ofuda",
      "/var",
      "/var/dmesg",
      "/var/muen",
      "/mnt",
      home,
      `${home}/desktop`,
      `${home}/hounou`,
    ];
    for (const d of dirs) await this.vfs.mkdir(d);
    for (const p of this.state.prefs) {
      await this.vfs.mkdir(`/mnt/${p.id}`);
      await this.vfs.mkdir(`/mnt/${p.id}/shrines`);
    }

    const manifesto = window.YAOYOROZU_MANIFESTO || [];
    const body = manifesto.map((c) => `CHAPTER ${c.ch} ${c.title}\n${c.body}`).join("\n\n");
    if (!(await this.vfs.getFile("/etc/宣言.yaoyorozu"))) {
      await this.vfs.write("/etc/宣言.yaoyorozu", body, "text/yaoyorozu");
    }
    const cons = window.YAOYOROZU_CONSTITUTION;
    if (cons && !(await this.vfs.getFile("/etc/ofuda/constitution.20"))) {
      const text = `${cons.title}\n${cons.preamble}\n\n${cons.articles
        .map((a) => `第${a.n}条 ${a.title}\n${a.body}`)
        .join("\n\n")}`;
      await this.vfs.write("/etc/ofuda/constitution.20", text, "text/yaoyorozu");
    }
    const proto = window.YAOYOROZU_PROTOCOLS || [];
    if (!(await this.vfs.getFile("/etc/ofuda/protocols.stack"))) {
      await this.vfs.write(
        "/etc/ofuda/protocols.stack",
        proto.map((p) => `[${p.layer}] ${p.name}\n${p.summary}\n${p.spec}\n指標: ${p.metric}`).join("\n\n"),
        "text/yaoyorozu"
      );
    }
    if (!(await this.vfs.getFile("/etc/三相電源.txt"))) {
      await this.vfs.write(
        "/etc/三相電源.txt",
        "法律だけでは乾く。祭だけでは散る。ソフトウェアだけでは冷たい。\n八百万OSは、この三つを同時に通電する。",
        "text/plain"
      );
    }
    const century = window.YAOYOROZU_CENTURY || [];
    if (!(await this.vfs.getFile("/etc/century.2100"))) {
      await this.vfs.write(
        "/etc/century.2100",
        century.map((c) => `${c.y} ${c.title}\n${c.body}`).join("\n\n"),
        "text/yaoyorozu"
      );
    }

    const desk = `${home}/desktop`;
    const gates = [
      ["当直.gate", "oncall"],
      ["列島.gate", "map"],
      ["神.gate", "proc"],
      ["縁fs.gate", "fs"],
      ["奉納.gate", "term"],
      ["祭暦.gate", "cal"],
      ["機械.gate", "sys"],
    ];
    for (const [name, app] of gates) {
      const path = `${desk}/${name}`;
      if (!(await this.vfs.getFile(path))) await this.vfs.write(path, app, "gate/app");
    }
  }

  defaultState(saved) {
    const ujiko = (saved && saved.ujiko) || loadUjiko();
    const today = jstDateKey();
    const lastDay = saved && saved.lastDay;
    let logoutDays = saved && saved.logoutDays ? saved.logoutDays : 1;
    if (lastDay && lastDay !== today) {
      const prev = new Date(`${lastDay}T00:00:00+09:00`);
      const now = new Date(`${today}T00:00:00+09:00`);
      const diff = Math.round((now - prev) / 86400000);
      logoutDays = diff === 1 ? logoutDays + 1 : 1;
    }
    const prefList = prefs().map((p) => ({
      ...p,
      load: Math.max(4, 100 - p.unusedCpu),
    }));
    const rng = mulberry32(hash32(`${ujiko}:genesis`));
    const authored = authoredKami().map((k, i) => ({ ...k, pid: 10 + i }));
    const generated = saved && saved.generated ? saved.generated : this.generateKami(rng);
    const spawned = (saved && saved.spawned) || [];
    const processes = [...authored, ...generated, ...spawned];
    this.pidSeq = processes.reduce((m, p) => Math.max(m, p.pid || 0), 80);
    return {
      ujiko,
      lastDay: today,
      logoutDays,
      visits: (saved && saved.visits + 1) || 1,
      currentSpace: (saved && saved.currentSpace) || "shimane",
      authenticated: false,
      officialDay: saved && saved.officialDay,
      officialStatus: saved && saved.officialStatus,
      processes,
      spawned,
      generated,
      prefs: prefList,
      quotas: shrineQuotas(prefList),
      sockets: (saved && saved.sockets) || this.seedSockets(prefList, processes, rng),
      fw: (saved && saved.fw) || LOCKED_FW.map((r) => ({ ...r })),
      dmesg: [],
      gep: saved && typeof saved.gep === "number" ? saved.gep : prefList.reduce((a, p) => a + p.en, 0) * 0.001,
      muen: saved && typeof saved.muen === "number" ? saved.muen : 23.4,
      tokyo: saved && typeof saved.tokyo === "number" ? saved.tokyo : 88,
      local: saved && typeof saved.local === "number" ? saved.local : 41,
      settings: {
        silent: true,
        irqMs: 16000,
        sound: false,
        ...(saved && saved.settings),
      },
      sim: saved && saved.sim ? saved.sim : { day: 0, running: false, logs: [] },
      hounou: (saved && saved.hounou) || [],
      muenPackets: (saved && saved.muenPackets) || [],
      clipboard: (saved && saved.clipboard) || [],
      recent: (saved && saved.recent) || [],
      history: (saved && saved.history) || [],
      maLocked: !!(saved && saved.maLocked),
      appProcs: [],
    };
  }

  seedSockets(prefList, processes, rng) {
    const socks = [];
    for (let i = 0; i < 36; i += 1) {
      const a = pick(rng, prefList);
      const b = pick(rng, processes);
      socks.push({
        id: `sock-${i}`,
        from: a.id,
        to: b.id,
        toName: b.name,
        ttl: 3 + ((rng() * 40) | 0),
        state: rng() > 0.12 ? "ESTAB" : "MUEN",
      });
    }
    return socks;
  }

  snapshot() {
    const s = this.state;
    return {
      ujiko: s.ujiko,
      lastDay: s.lastDay,
      logoutDays: s.logoutDays,
      visits: s.visits,
      currentSpace: s.currentSpace,
      officialDay: s.officialDay,
      officialStatus: s.officialStatus,
      spawned: s.spawned,
      sockets: s.sockets,
      clipboard: s.clipboard,
      recent: s.recent,
      history: s.history,
      maLocked: s.maLocked,
      fw: s.fw,
      gep: s.gep,
      muen: s.muen,
      tokyo: s.tokyo,
      local: s.local,
      settings: s.settings,
      sim: s.sim,
      hounou: s.hounou,
      muenPackets: s.muenPackets,
    };
  }

  async persist() {
    await this.vfs.metaSet("state", this.snapshot());
  }

  commit(immediate = false) {
    if (immediate) {
      if (this._commitT) {
        clearTimeout(this._commitT);
        this._commitT = null;
      }
      const done = this.persist();
      this.broadcast();
      return done;
    }
    if (this._commitT) return Promise.resolve();
    this._commitT = setTimeout(() => {
      this._commitT = null;
      this.persist();
      this.broadcast();
    }, 420);
    return Promise.resolve();
  }

  clipPush(text) {
    const t = String(text || "").slice(0, 2000).trim();
    if (!t) return null;
    if (!this.state.clipboard) this.state.clipboard = [];
    if (this.state.clipboard[0] && this.state.clipboard[0].t === t) return this.state.clipboard[0];
    const rec = { t, at: Date.now() };
    this.state.clipboard.unshift(rec);
    this.state.clipboard = this.state.clipboard.slice(0, 40);
    this.emit("clip");
    this.commit(true);
    return rec;
  }

  noteRecent(path) {
    const p = String(path || "");
    if (!p || p === "/") return;
    if (!this.state.recent) this.state.recent = [];
    this.state.recent = [{ path: p, at: Date.now() }, ...this.state.recent.filter((r) => r.path !== p)].slice(0, 24);
    this.emit("recent");
    this.commit(true);
  }

  pushHistory(line) {
    const t = String(line || "").trim();
    if (!t) return;
    if (!this.state.history) this.state.history = [];
    if (this.state.history[this.state.history.length - 1] === t) return;
    this.state.history.push(t);
    if (this.state.history.length > 80) this.state.history.shift();
    this.commit(true);
  }

  maSleep() {
    if (this.state.maLocked) return;
    this.state.maLocked = true;
    this.log("間に入った。ログアウトではない", "ma");
    this.emit("ma", true);
    this.commit();
  }

  maWake() {
    if (!this.state.maLocked) return;
    this.state.maLocked = false;
    this.log("間を終えた", "ma");
    this.emit("ma", false);
    this.commit();
  }

  rebuildProcesses() {
    const authored = authoredKami().map((k, i) => ({ ...k, pid: 10 + i }));
    if (!this.state.generated || !this.state.generated.length) {
      this.state.generated = this.generateKami(mulberry32(hash32(`${this.state.ujiko}:genesis`)));
    }
    this.state.processes = [...authored, ...this.state.generated, ...(this.state.spawned || [])];
  }

  applyRemote(msg) {
    if (!msg || !this.state) return;
    if (msg.type === "commit") {
      Object.assign(this.state, msg.state);
      this.rebuildProcesses();
      this.state.oncall = this.computeOncall();
      this.emit("remote");
      this.emit("change");
    }
    if (msg.type === "vfs") this.emit("vfs");
  }

  broadcast() {
    if (this.bus) this.bus.post({ type: "commit", state: this.snapshot() });
  }

  async boot() {
    await this.vfs.ready();
    const saved = await this.vfs.metaGet("state");
    this.state = this.defaultState(saved);
    this.state.oncall = this.computeOncall();
    await this.seedFs();
    this.bus = createBus((msg) => this.applyRemote(msg));
    try {
      this.worker = new Worker(new URL("./kernel-worker.js", import.meta.url), { type: "module" });
      this.worker.onmessage = () => this.tick();
    } catch (err) {
      setInterval(() => this.tick(), 1000);
    }
    this.log(`boot ujiko=${this.state.ujiko} space=${this.state.currentSpace} entropy=${this.state.oncall.entropy}`);
    this.log(`oncall kami=${this.state.oncall.kami.name} kernel=${this.state.oncall.pref.name} article=${this.state.oncall.article}`);
    this.ready = true;
    this.emit("boot");
    this.emit("change");
    return this;
  }

  tick() {
    if (!this.state) return;
    const list = this.state.processes;
    const n = list.length;
    if (!n) return;
    const start = (this._tickAt || 0) % n;
    this._tickAt = start + 40;
    for (let i = 0; i < 40; i += 1) {
      const p = list[(start + i) % n];
      if (!p || p.kind === "app") continue;
      const jitter = ((Math.random() * 5) | 0) - 2;
      p.cpu = Math.max(0, Math.min(99, (p.cpu || 0) + jitter));
    }
    if (!this.state.settings.silent && Math.random() < 0.04) {
      this.state.muen = Math.max(4, this.state.muen + (Math.random() - 0.55) * 0.08);
    }
    this.emit("tick");
  }

  spacePref() {
    return this.state.prefs.find((p) => p.id === this.state.currentSpace) || this.state.prefs[0];
  }

  requireAuth() {
    if (!this.state.authenticated) {
      const err = new Error("EPERM");
      err.code = "EPERM";
      throw err;
    }
  }

  kashiwa(mode = "official") {
    const today = jstDateKey();
    const official = mode === "official" && this.state.officialDay !== today;
    let status;
    if (official) {
      const rng = mulberry32(hash32(`${this.state.ujiko}:${today}:kashiwa`));
      status = SYSCALLS[(rng() * SYSCALLS.length) | 0];
      this.state.officialDay = today;
      this.state.officialStatus = status;
    } else {
      status = SYSCALLS[(Math.random() * SYSCALLS.length) | 0];
    }
    this.state.authenticated = true;
    const oncall = this.state.oncall;
    const job = this.applySyscall(status, oncall);
    this.log(`kashiwa ${official ? "official" : "reauth"} ${status} next=${job.kind}`, "auth");
    this.commit();
    this.emit("auth");
    this.emit("change");
    return { status, official, job, oncall, copy: `${this.state.ujiko}  ${status}  ${oncall.pref.name}/${oncall.kami.name}` };
  }

  applySyscall(status, oncall) {
    switch (status) {
      case "ATTACHED": {
        const kami = this.state.processes.find((p) => p.id === oncall.kami.id);
        if (kami) kami.attached = true;
        this.gepAdd(40);
        return { kind: "attach", prefId: oncall.pref.id, kamiId: oncall.kami.id, article: oncall.article };
      }
      case "EPERM":
        return { kind: "eperm", prefId: oncall.pref.id, article: oncall.article };
      case "ENOSPC":
        this.state.tokyo = Math.max(40, this.state.tokyo - 4);
        this.state.local = Math.min(92, this.state.local + 2);
        this.setSpace(oncall.pref.id, true);
        return { kind: "route", prefId: oncall.pref.id };
      case "ENOMEN":
        this.spawnMuen("名簿の空行");
        return { kind: "nomen", prefId: oncall.pref.id };
      case "SEASON_HOLD":
        this.log("季節が会議を遅延させた", "season");
        return { kind: "hold", prefId: oncall.pref.id, article: 4 };
      case "MIGRATE_QUEUED":
        this.log("この思想は遷宮待ちである", "sengu");
        return { kind: "migrate", prefId: oncall.pref.id };
      default:
        return { kind: "attach", prefId: oncall.pref.id };
    }
  }

  setSpace(prefId, silent = false) {
    const p = this.state.prefs.find((x) => x.id === prefId);
    if (!p) return null;
    this.state.currentSpace = prefId;
    if (!silent) this.log(`space ${p.name}`, "torii");
    this.commit();
    this.emit("space", p);
    this.emit("change");
    return p;
  }

  attachKami(id) {
    this.requireAuth();
    const kami = this.state.processes.find((p) => p.id === id);
    if (!kami) throw new Error("ESRCH");
    kami.attached = true;
    kami.status = "running";
    this.log(`attach ${kami.name}`, "proc");
    this.commit();
    this.emit("change");
    return kami;
  }

  harai(id) {
    const kami = this.state.processes.find((p) => p.id === id);
    if (!kami) throw new Error("ESRCH");
    if (kami.id === "zashiki") {
      this.log("座敷童: 空きプロセスを殺すな", "proc");
      throw new Error("EPERM");
    }
    kami.status = "running";
    kami.cpu = Math.max(1, (kami.cpu || 4) - 3);
    this.log(`harai ${kami.name}`, "proc");
    this.emit("change");
    return kami;
  }

  spawnKami({ name, role }) {
    this.requireAuth();
    const kami = {
      id: `user-${hexId(5)}`,
      name: name || "名無しの神",
      role: role || "新設",
      status: "running",
      cpu: 3,
      en: 1,
      note: "立てた。殺してはならない。",
      kind: "spawned",
      pref: this.state.currentSpace,
      pid: this.nextPid(),
      attached: true,
    };
    this.state.processes.push(kami);
    this.state.spawned.push(kami);
    this.gepAdd(12);
    this.log(`spawn ${kami.name}`, "proc");
    this.commit();
    this.emit("change");
    return kami;
  }

  spawnApp(appId, title) {
    const proc = {
      id: `app-${appId}-${this.nextPid()}`,
      appId,
      name: title || appId,
      role: "window",
      status: "running",
      kind: "app",
      pid: this.pidSeq,
      space: this.state.currentSpace,
    };
    this.state.appProcs.push(proc);
    this.emit("ps");
    return proc;
  }

  exitApp(pid) {
    this.state.appProcs = this.state.appProcs.filter((p) => p.pid !== pid);
    this.emit("ps");
  }

  ping(target = "縁") {
    const dest = this.state.prefs.find((p) => p.name === target || p.id === target) || this.state.oncall.pref;
    const ms = (Math.random() * 8 + 1).toFixed(2);
    this.log(`PING ${target} from ${dest.name} ttl=無限 time=${ms}ms`, "net");
    const sock = {
      id: `sock-ping-${Date.now()}`,
      from: this.state.currentSpace,
      to: dest.id,
      toName: dest.name,
      ttl: 99,
      state: "ESTAB",
    };
    this.state.sockets.unshift(sock);
    if (this.state.sockets.length > 80) this.state.sockets.pop();
    this.emit("net");
    this.emit("change");
    return { dest, ms };
  }

  migrateTokyo() {
    this.requireAuth();
    this.state.tokyo = Math.max(40, this.state.tokyo - 8);
    this.state.local = Math.min(92, this.state.local + 3);
    const dest = this.state.oncall.pref;
    this.setSpace(dest.id, true);
    this.log(`migrate 過密の龍 → ${dest.name}`, "net");
    this.commit();
    this.emit("change");
    return dest;
  }

  hounou(text) {
    if (!text) throw new Error("EINVAL");
    const kami = pick(() => Math.random(), this.state.processes.filter((p) => p.kind !== "app")) || this.state.oncall.kami;
    const rec = { at: Date.now(), text, to: kami.name };
    this.state.hounou.unshift(rec);
    this.gepAdd(3);
    this.log(`hounou → ${kami.name}: ${text}`, "pay");
    this.vfs.write(`/home/${this.state.ujiko}/hounou/${Date.now()}.txt`, `${kami.name}\n${text}`, "text/plain");
    this.commit();
    this.emit("change");
    return rec;
  }

  gepAdd(n) {
    this.state.gep += n;
  }

  addFwRule(name) {
    this.requireAuth();
    const rule = { id: `user-${hexId(4)}`, name, action: "allow", locked: false, note: "公開してよい儀礼" };
    this.state.fw.push(rule);
    this.log(`fw add ${name}`, "fw");
    this.commit();
    this.emit("change");
    return rule;
  }

  toggleFw(id) {
    const rule = this.state.fw.find((r) => r.id === id);
    if (!rule) throw new Error("ENOENT");
    if (rule.locked) throw new Error("EPERM");
    rule.action = rule.action === "deny" ? "allow" : "deny";
    this.log(`fw ${rule.name}=${rule.action}`, "fw");
    this.commit();
    this.emit("change");
    return rule;
  }

  spawnMuen(label) {
    const packet = {
      id: `muen-${hexId(4)}`,
      label: label || "名のない点",
      named: false,
      x: Math.random(),
      y: Math.random(),
    };
    this.state.muenPackets.push(packet);
    this.state.muen = Math.min(48, this.state.muen + 0.2);
    this.log(`muen packet ${packet.id}`, "muen");
    this.emit("muen", packet);
    this.emit("change");
    return packet;
  }

  nameMuen(id, name) {
    const p = this.state.muenPackets.find((x) => x.id === id);
    if (!p) throw new Error("ENOENT");
    p.named = true;
    p.label = name;
    this.state.muen = Math.max(4, this.state.muen - 0.35);
    this.vfs.write(`/home/${this.state.ujiko}/${name}.name`, `${id}\n${name}`, "text/plain");
    this.log(`named ${id} → ${name}`, "muen");
    this.commit();
    this.emit("change");
    return p;
  }

  denySwap() {
    this.state.tokyo = Math.min(96, this.state.tokyo + 0.2);
    this.state.local = Math.min(92, this.state.local + 1.2);
    this.log("スワップ差し戻し。地方神を復元した", "irq");
    this.emit("spotlight", this.state.oncall.pref.id);
    this.emit("change");
  }

  simLine(msg) {
    const t = `D${String(this.state.sim.day).padStart(4, "0")}  ${msg}`;
    this.state.sim.logs.push(t);
    if (this.state.sim.logs.length > 24) this.state.sim.logs.shift();
    return t;
  }

  simStep() {
    const sim = this.state.sim;
    if (sim.day >= 1000) return sim;
    sim.day += 1;
    const p = this.state.prefs[(Math.random() * this.state.prefs.length) | 0];
    const roll = Math.random();
    if (sim.day === 1) this.simLine("47カーネルの疎通確認。余っている神の申告を開始。");
    else if (sim.day === 100) this.simLine("奉納税パイロット。行き先が見える税が、島根と鳥取で通った。");
    else if (sim.day === 365) this.simLine("無縁スキャン全国試験。名前を呼ばれなかった人が、一度だけ呼ばれる。");
    else if (sim.day === 1000) this.simLine("最初の遷宮。うまくいかない制度を、祭とともに解体する。");
    else if (roll < 0.2) {
      this.simLine(`${p.name}: 祭が同期した。GEP +${(p.en * 0.01).toFixed(0)}`);
      this.gepAdd(p.en * 0.01);
      this.state.muen = Math.max(4, this.state.muen - 0.15);
      this.state.local = Math.min(92, this.state.local + 0.2);
    } else if (roll < 0.4) {
      this.simLine(`${p.name}: 無縁パケット検知。最小接続を提案（強制友情はしない）。`);
      this.state.muen = Math.max(4, this.state.muen - 0.08);
    } else if (roll < 0.55) {
      this.simLine("東京: 過密の龍が地方神をスワップアウトしようとした。ルーティングで差し戻し。");
      this.state.tokyo = Math.max(40, this.state.tokyo - 0.4);
    } else {
      this.simLine(`${p.name}: 日常が動いている。${p.kami}`);
      this.gepAdd(12);
    }
    if (sim.day >= 1000) {
      sim.running = false;
      this.simLine("1000日が満ちた。憲法第20条により、このシミュレータ自体を建て直せ。");
    }
    this.emit("sim");
    return sim;
  }

  sysctl(key, value) {
    if (key === "ma.silent") this.state.settings.silent = value === "1" || value === true || value === "true";
    else if (key === "irq.ms") this.state.settings.irqMs = Math.max(4000, Number(value) || 16000);
    else if (key === "sound") this.state.settings.sound = value === "1" || value === true;
    else throw new Error("EINVAL");
    this.log(`sysctl ${key}=${value}`, "sys");
    this.commit();
    this.emit("settings");
    return this.state.settings;
  }

  logout() {
    this.log("logout: EPERM 遷宮まで無効", "auth");
    const err = new Error("EPERM");
    err.code = "EPERM";
    throw err;
  }

  menubarLine() {
    const o = this.state.oncall;
    const leftover = ["burning", "smoldering", "offered", "unclaimed", "watching"][o.seed % 5];
    return `oncall=${o.kami.name} · kernel=${this.spacePref().name} · muen=${this.state.muen.toFixed(1)}% · entropy=${o.entropy} · leftover=${leftover}`;
  }
}

export const kernel = new Kernel();
export { SYSCALLS };
