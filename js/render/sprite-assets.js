(function () {
  "use strict";
  const C = window.Civ;
  if (!C) return;

  const root = "assets/sprites/";
  const atlases = {
    world: { src: root + "world_atlas.png", image: null, status: "loading" },
    extra: { src: root + "file_000000002d208210877c4978b05eaded.png", image: null, status: "loading" }
  };

  // Source rectangles are in original 1536x1024 atlas pixels.
  // Similar-looking variants are kept as alternatives, not duplicated game objects.
  const sprites = {
    tree_oak: ["extra", 0, 0, 105, 128],
    tree_pine: ["extra", 105, 0, 105, 130],
    tree_birch: ["extra", 210, 0, 105, 130],
    tree_autumn: ["extra", 445, 0, 105, 130],
    tree_pink: ["extra", 655, 0, 105, 130],
    tree_palm: ["extra", 760, 0, 95, 130],
    tree_wide: ["extra", 855, 0, 120, 130],
    bush: ["extra", 0, 130, 75, 70],
    flowers: ["extra", 160, 245, 65, 65],
    rock: ["extra", 1110, 130, 90, 90],
    mountain: ["extra", 1320, 220, 190, 210],
    house_wood: ["world", 460, 310, 120, 105],
    house_wood_alt: ["extra", 0, 345, 100, 105],
    house_stone: ["world", 455, 415, 120, 115],
    house_blue: ["extra", 95, 345, 105, 110],
    house_yellow: ["extra", 195, 345, 110, 110],
    farm_barn: ["world", 1160, 535, 165, 135],
    farm_fields: ["world", 1310, 550, 210, 115],
    mill: ["world", 690, 520, 125, 150],
    lumber_hut: ["world", 0, 530, 120, 120],
    quarry_mine: ["world", 0, 730, 145, 115],
    warehouse: ["world", 1120, 415, 125, 115],
    market_stall: ["world", 655, 850, 90, 75],
    fishery_boat: ["world", 1445, 715, 85, 90],
    castle: ["world", 1310, 410, 205, 125],
    construction_wood_0: ["world", 8, 338, 105, 72],
    construction_wood_1: ["world", 225, 318, 112, 100],
    construction_wood_2: ["world", 335, 315, 115, 105],
    construction_wood_3: ["world", 460, 310, 120, 105],
    construction_stone_0: ["world", 8, 420, 105, 85],
    construction_stone_1: ["world", 115, 415, 110, 95],
    construction_stone_2: ["world", 225, 415, 115, 105],
    construction_stone_3: ["world", 455, 415, 120, 115]
  };

  // Ground texture cells from the lower-left texture palette of the extra atlas.
  // Each cell is an individual tile texture, not a whole-atlas stretch.
  const terrainTextures = {
    grass: [["extra", 8, 770, 68, 68], ["extra", 84, 846, 68, 68]],
    forest: [["extra", 84, 846, 68, 68], ["extra", 8, 846, 68, 68]],
    desert: [["extra", 160, 770, 68, 68], ["extra", 388, 846, 68, 68]],
    tundra: [["extra", 236, 770, 68, 68], ["extra", 312, 922, 68, 68]],
    water: [["extra", 312, 770, 68, 68], ["extra", 388, 770, 68, 68]],
    swamp: [["extra", 160, 846, 68, 68], ["extra", 8, 922, 68, 68]],
    rock: [["extra", 236, 922, 68, 68], ["extra", 312, 922, 68, 68]],
    mountain: [["extra", 236, 922, 68, 68], ["extra", 312, 922, 68, 68]]
  };

  Object.keys(atlases).forEach(function (key) {
    const entry = atlases[key];
    const image = new Image();
    image.decoding = "async";
    image.onload = function () {
      entry.status = "ready";
      const canvas = document.getElementById("worldCanvas");
      const ctx = canvas && canvas.getContext("2d");
      if (ctx && C.world && C.world.draw) C.world.draw(ctx);
    };
    image.onerror = function () { entry.status = "error"; };
    image.src = entry.src;
    entry.image = image;
  });

  function draw(id, ctx, x, y, width, height) {
    const spec = sprites[id];
    if (!spec) return false;
    const atlas = atlases[spec[0]];
    const image = atlas && atlas.image;
    if (!image || atlas.status !== "ready" || !image.naturalWidth) return false;
    const sx = spec[1], sy = spec[2], sw = spec[3], sh = spec[4];
    const dpr = (C.camera && C.camera.dpr) || 1;
    const snap = value => Math.round(value * dpr) / dpr;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, sx, sy, sw, sh, snap(x), snap(y),
      Math.max(1 / dpr, snap(width)), Math.max(1 / dpr, snap(height)));
    ctx.restore();
    return true;
  }

  function drawTile(type, variant, ctx, x, y, width, height) {
    const choices = terrainTextures[type];
    if (!choices || !choices.length) return false;
    const spec = choices[Math.abs(variant || 0) % choices.length];
    const atlas = atlases[spec[0]];
    const image = atlas && atlas.image;
    if (!image || atlas.status !== "ready" || !image.naturalWidth) return false;
    const dpr = (C.camera && C.camera.dpr) || 1;
    const snap = value => Math.round(value * dpr) / dpr;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, spec[1], spec[2], spec[3], spec[4],
      snap(x), snap(y), Math.max(1 / dpr, snap(width)), Math.max(1 / dpr, snap(height)));
    ctx.restore();
    return true;
  }

  C.spriteAssets = {
    version: 2,
    atlases: atlases,
    sprites: sprites,
    has: function (id) {
      const spec = sprites[id];
      return !!spec && atlases[spec[0]].status === "ready";
    },
    draw: draw,
    drawTile: drawTile,
    getStatus: function () {
      return {
        world: atlases.world.status,
        extra: atlases.extra.status
      };
    }
  };
})();