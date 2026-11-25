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
    const treeIds = ["tree_oak", "tree_pine", "tree_birch", "tree_autumn", "tree_pink", "tree_palm", "tree_wide"];
    if (C.spriteAssets && C.spriteAssets.draw(treeIds[variant % treeIds.length], ctx, x, y, size, size)) return;
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

  function drawHouse(ctx, x, y, size, type, unit, worldX, worldY) {
    // Civic and landmark sprites use their own proportions while sharing the
    // same bottom-center ground anchor as ordinary buildings.
    const landmark = {
      lighthouse: ["lighthouse", .92, 1.9],
      temple: ["temple", 1.8, 1.55],
      cathedral: ["cathedral", 2.05, 1.9],
      portal: ["portal", .95, 1.12],
      stone_arch: ["stone_arch", 1.15, 1.05],
      campfire: ["campfire", .72, .9],
      tent: ["tent", .92, 1.0],
      well: ["well", .78, .78],
      statue: ["statue", .72, 1.12]
    }[type];
    if (landmark && C.spriteAssets && C.spriteAssets.draw(
      landmark[0], ctx,
      x - size * landmark[1] / 2,
      y + size - size * landmark[2],
      size * landmark[1],
      size * landmark[2]
    )) return;

    let houseEra = 2;
    if(type==="house" && C.research){
      houseEra=C.research.isCompleted("engineering")?4:
        C.research.isCompleted("masonry")?3:
        C.research.isCompleted("woodworking")?2:1;
      if(houseEra===1 && C.spriteAssets && C.spriteAssets.draw("tent",ctx,x-size*.05,y+size*.10,size*1.05,size*.78))return;
      if(houseEra===3 && C.spriteAssets && C.spriteAssets.draw("house_stone",ctx,x-size*.25,y-size*.58,size*1.35,size*1.28))return;
      if(houseEra===4 && C.spriteAssets && C.spriteAssets.draw("house_blue",ctx,x-size*.24,y-size*.55,size*1.30,size*1.30)){
        px(ctx,x+size*.68,y-size*.34,size*.10,size*.22,"#596d7b",unit);
        return;
      }
    }
    const spriteId = type === "warehouse" ? "warehouse" :
      type === "farm" ? "farm_barn" : type === "lumber" ? "lumber_hut" :
      type === "quarry" ? "quarry_mine" : type === "iron_mine" ? "mine_iron" : type === "copper_mine" ? "mine_copper" : type === "market" ? "market_stall" :
      type === "fishery" ? "fishery_boat" : type === "city_center" ? "castle" :
      (type === "house" ? ["house_wood", "house_wood_alt", "house_yellow", "house_wood"][ 
        Math.floor(hash(Number.isFinite(worldX) ? worldX : Math.round(x / Math.max(1, size)),
          Number.isFinite(worldY) ? worldY : Math.round(y / Math.max(1, size)), 19) * 4)
      ] : "house_wood");
    if (C.spriteAssets && C.spriteAssets.draw(spriteId, ctx, x - size*.24, y - size*.52, size*1.30, size*1.30)) return;
    const wall = type === "warehouse" ? "#b7a17a" : type === "iron_mine" ? "#8c9699" : type === "copper_mine" ? "#bd8055" : "#c5a879";
    const roof = type === "city_center" ? "#765044" : type === "iron_mine" ? "#4f5b62" : type === "copper_mine" ? "#865235" : "#914f3d";
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
    let atlasDrawn = false;
    if (C.spriteAssets) {
      atlasDrawn = C.spriteAssets.draw("farm_fields", ctx, x - size*.18, y - size*.28, size*1.36, size*1.10);
      if (atlasDrawn) C.spriteAssets.draw("farm_barn", ctx, x + size*.18, y - size*.12, size*.62, size*.68);
    }
    if (atlasDrawn) return;
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

  function drawWildlife(ctx,tile,sx,sy,cell,unit) {
    if(cell<15 || !tile.wildlife)return;
    const x=sx+cell*(.25+hash(tile.x,tile.y,71)*.25);
    const y=sy+cell*(.47+hash(tile.x,tile.y,72)*.12);
    const u=Math.max(unit,Math.floor(cell/18));
    const body=tile.wildlife==="deer"?"#a97845":tile.wildlife==="boar"?"#76513d":tile.wildlife==="chicken"?"#eee0b5":"#b9b7a9";
    const dark="#403b34";
    px(ctx,x+u*2,y+u,u*5,u*3,body,u);
    px(ctx,x+u*6,y,u*2,u*2,body,u);
    px(ctx,x+u*7,y+u,u,u,"#262b29",u);
    px(ctx,x+u*3,y+u*3,u,u*2,dark,u);
    px(ctx,x+u*6,y+u*3,u,u*2,dark,u);
    if(tile.wildlife==="deer"){
      px(ctx,x+u*6,y-u*2,u,u*2,"#d6c09a",u);
      px(ctx,x+u*8,y-u*2,u,u*2,"#d6c09a",u);
    }else if(tile.wildlife==="chicken"){
      px(ctx,x+u*7,y-u,u*2,u,"#c94e3d",u);
      px(ctx,x+u*8,y+u,u,u,"#d6a34d",u);
    }else if(tile.wildlife==="rabbit"){
      px(ctx,x+u*6,y-u*3,u,u*3,"#d9d5c7",u);
      px(ctx,x+u*8,y-u*3,u,u*3,"#d9d5c7",u);
    }else{
      px(ctx,x+u*8,y+u*2,u*2,u,"#c4a18a",u);
    }
  }

  function drawTileDetails(ctx, tile, sx, sy, cell, unit) {
    const r = hash(tile.x, tile.y, 31);
    const palette = palettes[tile.type] || palettes.grass;
    if (tile.type === "forest") {
      if (cell >= 16) {
        const size = cell * (.72 + r*.14);
        drawTree(ctx, sx + cell*(.12+r*.12), sy + cell*(.08+r*.12), size, Math.floor(r*7), unit);
      } else {
        px(ctx, sx+cell*.25, sy+cell*.2, cell*.5, cell*.5, palette[0], unit);
        px(ctx, sx+cell*.36, sy+cell*.25, cell*.24, cell*.2, palette[2], unit);
      }
    } else if (tile.type === "grass" || tile.type === "swamp") {
      if (r > .42 && cell > 12) {
        const dx = sx + cell*(.2+r*.45);
        const dy = sy + cell*(.25+hash(tile.x,tile.y,8)*.4);
        if (C.spriteAssets && r > .76 &&
            C.spriteAssets.draw("flowers", ctx, dx, dy, cell*.30, cell*.28)) {
        } else if (C.spriteAssets && r > .61 &&
            C.spriteAssets.draw("bush", ctx, dx, dy, cell*.42, cell*.40)) {
        } else {
          px(ctx, dx, dy, cell*.09, cell*.08, palette[3], unit);
          px(ctx, sx+cell*(.25+r*.35), sy+cell*.48, cell*.06, cell*.1, palette[2], unit);
        }
      }
    } else if (tile.type === "water") {
      if (cell > 10) {
        px(ctx, sx+cell*(.12+r*.45), sy+cell*.3, cell*.22, Math.max(unit,cell*.055), palette[3], unit);
        px(ctx, sx+cell*(.45+r*.25), sy+cell*.68, cell*.2, Math.max(unit,cell*.05), palette[1], unit);
      }
    } else if (tile.type === "rock" || tile.type === "mountain") {
      if (C.spriteAssets) {
        const id = tile.type === "mountain" ? "mountain" : "rock";
        const drawn = C.spriteAssets.draw(id, ctx,
          sx + (tile.type === "mountain" ? cell*.02 : cell*.15),
          sy + (tile.type === "mountain" ? cell*.02 : cell*.22),
          cell * (tile.type === "mountain" ? .96 : .70),
          cell * (tile.type === "mountain" ? .96 : .65));
        if (drawn) return;
      }
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
    if(tile.berryBush && cell>=14){
      const bx=sx+cell*(.54+hash(tile.x,tile.y,93)*.12),by=sy+cell*.55;
      px(ctx,bx,by,cell*.27,cell*.17,"#315b36",unit);
      px(ctx,bx+cell*.04,by-cell*.07,cell*.16,cell*.12,"#568548",unit);
      px(ctx,bx+cell*.08,by+cell*.03,cell*.045,cell*.045,"#c93648",unit);
      px(ctx,bx+cell*.19,by+cell*.02,cell*.045,cell*.045,"#d94750",unit);
      px(ctx,bx+cell*.14,by-cell*.03,cell*.04,cell*.04,"#e35a5d",unit);
    }
    drawWildlife(ctx,tile,sx,sy,cell,unit);
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
        // Replace flat biome fills with pixel textures from the user's atlas.
        // Deterministic variation prevents texture flicker while panning or redrawing.
        if (C.spriteAssets && C.spriteAssets.drawTile) {
          C.spriteAssets.drawTile(tile.type, Math.floor(hash(x, y, 73) * 2), ctx,
            sx, sy, cell + pixelStep, cell + pixelStep);
        }
        drawShoreline(ctx,tile,sx,sy,cell,unit);
        // Buildings and construction sites own their footprint; never draw biome props underneath them.
        if (!tile.building && !tile.construction) drawTileDetails(ctx,tile,sx,sy,cell,unit);

        if (tile.deposit && !tile.building && !tile.construction && cell >= 13) {
          const oreColor = tile.deposit === "iron" ? "#a7aeb0" : tile.deposit === "copper" ? "#c47b4b" : "#d0c4a0";
          const oreLight = tile.deposit === "iron" ? "#e0e5e3" : tile.deposit === "copper" ? "#e7a16b" : "#f0e2bf";
          px(ctx, sx + cell*.31, sy + cell*.49, cell*.30, cell*.22, "#55534d", unit);
          px(ctx, sx + cell*.37, sy + cell*.43, cell*.15, cell*.12, oreColor, unit);
          px(ctx, sx + cell*.55, sy + cell*.53, cell*.12, cell*.10, oreColor, unit);
          px(ctx, sx + cell*.40, sy + cell*.44, cell*.06, cell*.05, oreLight, unit);
          px(ctx, sx + cell*.58, sy + cell*.53, cell*.05, cell*.04, oreLight, unit);
        }
        if (tile.building && cell >= 13) {
          const size=cell*0.82;
          if(tile.building.type==="chicken_coop"){
            drawHouse(ctx,sx,sy,size,"house",unit,x,y);
            px(ctx,sx+cell*.68,sy+cell*.66,cell*.22,cell*.10,"#d9c18b",unit);
            px(ctx,sx+cell*.72,sy+cell*.57,cell*.05,cell*.09,"#eee0b5",unit);
            px(ctx,sx+cell*.79,sy+cell*.57,cell*.05,cell*.09,"#eee0b5",unit);
          } else if (tile.building.type === "farm") drawFarm(ctx,sx,sy,size,unit);
          else if (tile.building.type === "quarry") {
            drawHouse(ctx,sx,sy,cell,"quarry",unit,x,y);
          } else if (tile.building.type === "lumber") {
            drawHouse(ctx,sx,sy,cell,"lumber",unit,x,y);
            px(ctx,sx+cell*.72,sy+cell*.64,cell*.16,cell*.12,"#8d623e",unit);
          } else drawHouse(ctx,sx,sy,size,tile.building.type,unit,x,y);
        }
      }

      if (C.citizens) C.citizens.draw(ctx, camera, cell, x0, y0, x1, y1);
      ctx.restore();
    } finally {
      camera.x = savedX;
      camera.y = savedY;
      C.camera.cell = savedBaseCell;
    }
  };

  C.pixelArt = { enabled: true, style: "worldbox-inspired", version: 4 };
})();