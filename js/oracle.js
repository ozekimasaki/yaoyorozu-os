(function () {
  function pick(list) {
    return list[(Math.random() * list.length) | 0];
  }

  function pickN(list, n) {
    const copy = list.slice();
    const out = [];
    while (copy.length && out.length < n) {
      out.push(copy.splice((Math.random() * copy.length) | 0, 1)[0]);
    }
    return out;
  }

  function hex(n) {
    let s = "";
    while (s.length < n) s += Math.random().toString(16).slice(2);
    return s.slice(0, n);
  }

  const NORITO = [
    "高天原に神留り坐す",
    "神ながらも",
    "神はマイクロサービスである。教団は単一障害点である",
    "選ばれていない。しかし記載されている",
    "ログアウトは遷宮まで無効",
    "血は不要。名簿だけで足りる",
  ];

  const TOASTS = [
    "氏子課: このブラウザは、すでに社に届いている。",
    "神託: 会議するな。踊れ。",
    "献金ではなく奉納。拒否も、記録される。",
  ];

  window.YaoyorozuOracle = { pick, pickN, norito: NORITO, toast: function(){}, start: function(){} };
})();
