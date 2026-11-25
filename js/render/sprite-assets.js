(function () {
  "use strict";
  const C = window.Civ;
  if (!C) return;

  const root = "assets/sprites/";
  const atlases = {
    world: { src: root + "world_atlas.png", image: null, status: "loading" },
    extra: { src: root + "file_000000002d208210877c4978b05eaded.png", image: null, status: "loading" }
  };

  // Source rectangles were corrected against the generated contact sheets.\n  // Coordinates are tight foreground bounds in the original 1536x1024 atlas pixels.
  // Similar-looking variants are kept as alternatives, not duplicated game objects.
  const sprites = {
    tree_oak: ["extra", 21, 54, 91, 75],
    tree_pine: ["world", 377, 8, 69, 83],
    tree_birch: ["world", 884, 0, 70, 104],
    tree_autumn: ["extra", 451, 0, 90, 124],
    tree_pink: ["extra", 638, 0, 90, 124],
    tree_palm: ["extra", 743, 37, 68, 87],
    tree_wide: ["extra", 820, 36, 116, 88],
    bush: ["extra", 1401, 148, 35, 30],
    flowers: ["world", 693, 235, 25, 28],
    rock: ["world", 1056, 113, 47, 55],
    mountain: ["world", 1268, 176, 134, 73],
    house_wood: ["world", 465, 313, 109, 90],
    house_wood_alt: ["extra", 12, 345, 71, 75],
    house_stone: ["extra", 126, 531, 85, 108],
    house_blue: ["extra", 166, 352, 77, 68],
    house_yellow: ["extra", 199, 425, 81, 82],
    farm_barn: ["world", 998, 554, 179, 116],
    farm_fields: ["world", 1339, 576, 108, 77],
    mill: ["world", 702, 519, 131, 227],
    lumber_hut: ["world", 7, 527, 99, 90],
    quarry_mine: ["world", 10, 728, 148, 120],
    warehouse: ["extra", 1060, 538, 83, 92],
    market_stall: ["world", 657, 861, 53, 77],
    fishery_boat: ["world", 1452, 782, 77, 78],
    castle: ["world", 780, 417, 107, 95],
    lighthouse: ["world", 408, 723, 64, 126],
    temple: ["world", 847, 656, 125, 110],
    cathedral: ["world", 1020, 678, 157, 144],
    portal: ["world", 1189, 944, 59, 68],
    stone_arch: ["world", 1298, 703, 53, 50],
    campfire: ["world", 1139, 860, 48, 69],
    tent: ["world", 1199, 867, 50, 60],
    well: ["world", 1047, 894, 43, 44],
    statue: ["world", 700, 679, 36, 52],
    construction_wood_0: ["world", 0, 351, 104, 74],
    construction_wood_1: ["world", 232, 330, 96, 73],
    construction_wood_2: ["world", 344, 330, 101, 73],
    construction_wood_3: ["world", 465, 313, 109, 90],
    construction_stone_0: ["world", 7, 432, 99, 64],
    construction_stone_1: ["world", 115, 415, 110, 95],
    construction_stone_2: ["world", 225, 415, 115, 105],
    construction_stone_3: ["world", 780, 417, 107, 95]
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
    version: 4,
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