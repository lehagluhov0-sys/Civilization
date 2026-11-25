(function () {
  "use strict";
  const C = window.Civ;
  if (!C) return;

  const root = "assets/sprites/";
  const manifest = {
    tree_oak: root + "tree_oak.svg",
    house_small: root + "house_small.svg",
    farm: root + "farm.svg",
    rock: root + "rock.svg"
  };
  const images = Object.create(null);
  const status = Object.create(null);

  Object.keys(manifest).forEach(function (id) {
    const image = new Image();
    image.decoding = "async";
    status[id] = "loading";
    image.onload = function () {
      status[id] = "ready";
      if (C.world && typeof C.world.draw === "function") {
        const canvas = document.getElementById("worldCanvas");
        const ctx = canvas && canvas.getContext("2d");
        if (ctx) C.world.draw(ctx);
      }
    };
    image.onerror = function () {
      status[id] = "fallback";
    };
    image.src = manifest[id];
    images[id] = image;
  });

  C.spriteAssets = {
    version: 1,
    manifest: manifest,
    status: status,
    has: function (id) {
      return !!images[id] && status[id] === "ready";
    },
    draw: function (id, ctx, x, y, width, height) {
      const image = images[id];
      if (!image || status[id] !== "ready" || !image.naturalWidth) return false;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, Math.round(x), Math.round(y),
        Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
      ctx.restore();
      return true;
    },
    getStatus: function () {
      return Object.keys(status).reduce(function (result, id) {
        result[id] = status[id];
        return result;
      }, {});
    }
  };
})();