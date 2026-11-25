(function () {
  "use strict";
  const C = window.Civ;
  if (!C || !C.world || !C.camera) return;

  const palettes = {
    grass: ["#789653", "#86a45d", "#668447", "#9ab36a"],
    forest: ["#557b45", "#668b4d", "#3f693d", "#8ba85a"],
    water: ["#285b7b", "#34769a", "#4a8eaa", "#8bb9bd"],
    rock: ["#77776d", "#929084", "#5c625d", "#b1a895"],
    mountain: ["#68736f", "#87918a", "#4d5b59", "#d4d8c8"],
    desert: ["#b89b5e", "#d0b878", "#9d804b", "#e0ca8c"],
    tundra: ["#a5b7b4", "#c1cfca", "#829995", "#e1e8df"],
    swamp: ["#586f54", "#6f8057", "#405c4b", "#9ba36a"]
  };

  function hash(x, y, salt) {
    const n = Math.sin(x * 127.1 + y * 311.7 + salt * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function px(ctx, x, y, w, h, color, unit) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x / unit) * unit, Math.round(y / unit) * unit,
      Math.max(unit, Math.round(w / unit) * unit),
      Math.max(unit, Math.round(h / unit) * unit));
  }

  function drawTree(ctx, x, y, size, variant, unit) {
    if (C.spriteAssets && C.spriteAssets.draw("tree_oak", ctx, x, y, size, size)) return;
    const dark = variant % 2 ? "#294d35" : "#31583a";
    const mid = variant % 2 ? "#477747" : "#568449";
    const light = variant % 2 ? "#78a653" : "#8bb45d";
    px(ctx, x + size*.43, y + size*.57, size*.16, size*.34, "#79583b", unit);
    px(ctx, x + size*.20, y + size*.32, size*.58, size*.38, dark, unit);
    px(ctx, x + size*.30, y + size*.15, size*.50, size*.40, mid, unit);
    px(ctx, x + size*.40, y + size*.08, size*.28, size*.22, light, unit);
    px(ctx, x + size*.14, y + size*.42, size*.18, size*.17, mid, unit);
    px(ctx, x + size*.68, y + size*.36, size*.18, size*.19, dark, unit);
    px(ctx, x + size*.31, y + size*.30, size*.16, size*.10, light, unit);
  }

  function drawHouse(ctx, x, y, size, type, unit) {
    if (type !== "warehouse" && type !== "city_center" && C.spriteAssets &&
        C.spriteAssets.draw("house_small", ctx, x, y, size, size * 0.9)) return;
    const wall = type === "warehouse" ? "#b7a17a" : "#c5a879";
    const roof = type === "city_center" ? "#765044" : "#914f3d";
    px(ctx, x + size*.16, y + size*.42, size*.70, size*.42, "#463d32", unit);
    px(ctx, x + size*.22, y + size*.34, size*.58, size*.43, wall, unit);
    px(ctx, x + size*.13, y + size*.23, size*.76, size*.24, roof, unit);
    px(ctx, x + size*.24, y + size*.18, size*.52, size*.12, "#b56b4d", unit);
    px(ctx, x + size*.47, y + size*.55, size*.13, size*.29, "#59412f", unit);
    px(ctx, x + size*.29, y + size*.47, size*.12, size*.12, "#d8d49a", unit);
    px(ctx, x + size*.67, y + size*.47, size*.10, size*.12, "#d8d49a", unit);
    px(ctx, x + size*.18, y + size*.80, size*.68, size*.07, "#5c503d", unit);
  }

  function drawFarm(ctx, x, y, size, unit) {
    if (C.spriteAssets && C.spriteAssets.draw("farm", ctx, x, y, size, size * 0.82)) return;
    px(ctx, x + size*.08, y + size*.35, size*.84, size*.48, "#9c854b", unit);
    for (let i=0;i<4;i++) {
      px(ctx, x + size*(.17+i*.18), y + size*.39, size*.07, size*.39, "#d1b76c", unit);
      px(ctx, x + size*(.13+i*.18), y + size*.44, size*.06, size*.29, "#6f8d48", unit);
    }
    px(ctx, x + size*.12, y + size*.28, size*.76, size*.07, "#70543a", unit);
  }

  function drawShoreline(ctx, tile, sx, sy, cell, unit) {
    if (!tile.coastEdges || cell < 12) return;
    const sand = "#c5ad72";
    const pale = "#e0cb91";
    const edge = cell * 0.13;
    if (tile.coastEdges.north) {
      px(ctx, sx + cell*.08, sy + cell*.02, cell*.84, edge, sand, unit);
      px(ctx, sx + cell*.22, sy + cell*.02, cell*.34, edge*.38, pale, unit);
    }
    if (tile.coastEdges.east) {
      px(ctx, sx + cell - edge, sy + cell*.08, edge, cell*.84, sand, unit);
      px(ctx, sx + cell - edge*.42, sy + cell*.28, edge*.38, cell*.34, pale, unit);
    }
    if (tile.coastEdges.south) {
      px(ctx, sx + cell*.08, sy + cell - edge, cell*.84, edge, sand, unit);
      px(ctx, sx + cell*.48, sy + cell - edge*.42, cell*.30, edge*.38, pale, unit);
    }
    if (tile.coastEdges.west) {
      px(ctx, sx + cell*.02, sy + cell*.08, edge, cell*.84, sand, unit);
      px(ctx, sx + cell*.02, sy + cell*.54, edge*.38, cell*.26, pale, unit);
    }
  }

  function drawTileDetails(ctx, tile, sx, sy, cell, unit) {
    const r = hash(tile.x, tile.y, 31);
    const palette = palettes[tile.type] || palettes.grass;
    if (tile.type === "forest") {
      if (cell >= 16) {
        const size = cell * (.72 + r*.14);
        drawTree(ctx, sx + cell*(.12+r*.12), sy + cell*(.08+r*.12), size, Math.floor(r*4), unit);
      } else {
        px(ctx, sx+cell*.25, sy+cell*.2, cell*.5, cell*.5, palette[0], unit);
        px(ctx, sx+cell*.36, sy+cell*.25, cell*.24, cell*.2, palette[2], unit);
      }
    } else if (tile.type === "grass" || tile.type === "swamp") {
      if (r > .42 && cell > 12) {
        px(ctx, sx+cell*(.2+r*.45), sy+cell*(.25+hash(tile.x,tile.y,8)*.4), cell*.09, cell*.08, palette[3], unit);
        px(ctx, sx+cell*(.25+r*.35), sy+cell*.48, cell*.06, cell*.1, palette[2], unit);
      }
    } else if (tile.type === "water") {
      if (cell > 10) {
        px(ctx, sx+cell*(.12+r*.45), sy+cell*.3, cell*.22, Math.max(unit,cell*.055), palette[3], unit);
        px(ctx, sx+cell*(.45+r*.25), sy+cell*.68, cell*.2, Math.max(unit,cell*.05), palette[1], unit);
      }
    } else if (tile.type === "rock" || tile.type === "mountain") {
      if (tile.type === "rock" && C.spriteAssets &&
          C.spriteAssets.draw("rock", ctx, sx + cell*.15, sy + cell*.22, cell*.7, cell*.65)) return;
      px(ctx, sx+cell*.18, sy+cell*.52, cell*.26, cell*.22, palette[2], unit);
      px(ctx, sx+cell*.52, sy+cell*.38, cell*.29, cell*.32, palette[0], unit);
      px(ctx, sx+cell*.57, sy+cell*.4, cell*.13, cell*.07, palette[3], unit);
    } else if (tile.type === "desert") {
      px(ctx, sx+cell*.18, sy+cell*.68, cell*.52, Math.max(unit,cell*.045), palette[3], unit);
      px(ctx, sx+cell*.7, sy+cell*.28, cell*.06, cell*.06, palette[2], unit);
    } else if (tile.type === "tundra") {
      px(ctx, sx+cell*.24, sy+cell*.38, cell*.42, Math.max(unit,cell*.06), palette[3], unit);
      px(ctx, sx+cell*.52, sy+cell*.55, cell*.23, Math.max(unit,cell*.06), palette[1], unit);
    }
  }

  const originalDraw = C.world.draw;
  C.world.draw = function (ctx) {
    const camera = C.state.camera;
    const zoom = camera.zoom;
    const dpr = C.camera.dpr || 1;
    // Align both camera translation AND tile pitch to physical display pixels.
    // Snapping only camera.x/y is insufficient when zoom makes tile edges fractional.
    const pixelStep = 1 / dpr;
    const savedX = camera.x;
    const savedY = camera.y;
    const savedBaseCell = C.camera.cell;
    const renderCell = Math.max(pixelStep, Math.round(savedBaseCell * zoom / pixelStep) * pixelStep);
    const cell = renderCell;
    const renderX = Math.round(savedX / pixelStep) * pixelStep;
    const renderY = Math.round(savedY / pixelStep) * pixelStep;
    camera.x = renderX;
    camera.y = renderY;
    C.camera.cell = renderCell / zoom;

    try {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      originalDraw.call(this, ctx);
      ctx.restore();

      if (cell < 7) return;

      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.beginPath();
      ctx.rect(0, 0, C.camera.width, C.camera.height);
      ctx.clip();

      const x0 = Math.max(0, Math.floor(-camera.x / cell));
      const y0 = Math.max(0, Math.floor(-camera.y / cell));
      const x1 = Math.min(this.width, Math.ceil((C.camera.width-camera.x)/cell));
      const y1 = Math.min(this.height, Math.ceil((C.camera.height-camera.y)/cell));
      // Sprite details move on the physical pixel grid too; larger per-tile
      // quantization caused their edges to jump while panning.
      const unit = pixelStep;

      for (let y=y0;y<y1;y++) for (let x=x0;x<x1;x++) {
        const tile=this.get(x,y);
        if (!tile) continue;
        const sx=camera.x+x*cell, sy=camera.y+y*cell;
        drawShoreline(ctx,tile,sx,sy,cell,unit);
        drawTileDetails(ctx,tile,sx,sy,cell,unit);

        if (tile.building && cell >= 13) {
          const size=cell*1.02;
          if (tile.building.type === "farm") drawFarm(ctx,sx,sy,size,unit);
          else if (tile.building.type === "quarry") {
            drawTree(ctx,sx+cell*.08,sy+cell*.1,cell*.62,2,unit);
            px(ctx,sx+cell*.56,sy+cell*.56,cell*.32,cell*.25,"#85877e",unit);
            px(ctx,sx+cell*.61,sy+cell*.54,cell*.12,cell*.08,"#c1bca8",unit);
          } else if (tile.building.type === "lumber") {
            drawHouse(ctx,sx,sy,cell,"warehouse",unit);
            px(ctx,sx+cell*.72,sy+cell*.64,cell*.16,cell*.12,"#8d623e",unit);
          } else drawHouse(ctx,sx,sy,size,tile.building.type,unit);
        }
      }

      if (C.state.selected) {
        const p=C.state.selected;
        ctx.strokeStyle="#f3d27e";
        ctx.lineWidth=Math.max(1,1.5*zoom);
        ctx.strokeRect(camera.x+p.x*cell+1,camera.y+p.y*cell+1,cell-2,cell-2);
      }
      ctx.restore();
    } finally {
      camera.x = savedX;
      camera.y = savedY;
      C.camera.cell = savedBaseCell;
    }
  };

  C.pixelArt = { enabled: true, style: "worldbox-inspired", version: 3 };
})();