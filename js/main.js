(function () {
  "use strict";
  const C = window.Civ;

  function showStartupError(error) {
    const box = document.getElementById("startupError");
    const message = error && error.message ? error.message : String(error);
    console.error("Civilization startup error:", error);
    if (!box) {
      alert("Не удалось запустить игру: " + message);
      return;
    }
    box.hidden = false;
    box.innerHTML = "";
    const title = document.createElement("strong");
    title.textContent = "Не удалось запустить Civilization";
    const details = document.createElement("pre");
    details.textContent = message + "\\n\\nОткрой консоль браузера или отправь этот текст разработчику.";
    box.append(title, details);
  }

  function frame(now) {
    try {
      if (!C._lastFrame) C._lastFrame = now;
      const dt = Math.min((now - C._lastFrame) / 1000, 0.1);
      C._lastFrame = now;
      C.time.update(dt);
      if (C.citizens) C.citizens.update(dt);
      requestAnimationFrame(frame);
    } catch (error) {
      showStartupError(error);
    }
  }

  function start() {
    try {
      if (!C || !C.state || !C.world || !C.camera || !C.time || !C.city || !C.ui) {
        throw new Error("Не загружен один из игровых модулей. Проверь файлы и пути в index.html.");
      }
      if (!C.world.tiles.length) C.world.init();
      const restored = C.save ? C.save.load() : false;
      if (!C.city.center) C.city.init();
      else C.city.recalculate();
      if (C.citizens) C.citizens.init();
      if (C.infrastructure) C.infrastructure.updateNetwork();
      if (C.politics) C.politics.init();
      if (restored) C.camera.ready = true;
      C.camera.resize();
      if (!restored) C.camera.center();
      C.ui.init();
      if (C.save) C.save.init();
      if (restored) C.log("Сохранение загружено. Продолжаем развитие поселения.");
      C.ui.draw();
      C.ui.openMainMenu(!restored);
      window.addEventListener("resize", function () {
        C.camera.resize();
        C.ui.draw();
      });
      window.addEventListener("error", function (event) {
        showStartupError(event.error || event.message || "Неизвестная ошибка JavaScript");
      });
      requestAnimationFrame(frame);
      C.log("Поселение основано. Строй здания и развивай экономику.");
    } catch (error) {
      showStartupError(error);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();