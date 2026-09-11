(function () {
  function pick(list) {
    return list[(Math.random() * list.length) | 0];
  }
  window.YaoyorozuOracle = { pick };
})();
