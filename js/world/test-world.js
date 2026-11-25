(function () {
  "use strict";
  const C = window.Civ;
  const W = 128;
  const H = 128;

  function seededHash(x, y, seed) {
    const value = Math.sin(x * 127.1 + y * 311.7 + seed * 0.0137) * 43758.5453;
    return value - Math.floor(value);
  }

  function smooth(value) {
    return value * value * (3 - 2 * value);
  }

  function valueNoise(x, y, seed) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = smooth(x - x0);
    const ty = smooth(y - y0);
    const a = seededHash(x0, y0, seed);
    const b = seededHash(x0 + 1, y0, seed);
    const c = seededHash(x0, y0 + 1, seed);
    const d = seededHash(x0 + 1, y0 + 1, seed);
    const top = a + (b - a) * tx;
    const bottom = c + (d - c) * tx;
    return top + (bottom - top) * ty;
  }

  function fractalNoise(x, y, seed) {
    return valueNoise(x, y, seed) * 0.56 +
      valueNoise(x * 2.05, y * 2.05, seed + 11) * 0.29 +
      valueNoise(x * 4.1, y * 4.1, seed + 23) * 0.15;
  }

  function terrain(x, y, seed, landScore) {
    const humidity = fractalNoise(x / 8.2 + 18, y / 8.2 - 9, seed + 47);
    const temperature = 0.9 - Math.abs(y / (H - 1) - 0.5) * 1.65 +
      fractalNoise(x / 15 + 3, y / 15 + 20, seed + 71) * 0.12;
    const localRelief = fractalNoise(x / 7.2, y / 7.2, seed + 211);
    const elevation = 0.40 + Math.max(0, landScore) * 0.34 + localRelief * 0.24;

    if (landScore <= 0) return "water";
    if (temperature < 0.28) return "tundra";
    if (elevation > 0.77) return "mountain";
    if (elevation > 0.68) return "rock";
    if (humidity > 0.76 && elevation < 0.61) return "swamp";
    if (temperature > 0.58 && humidity < 0.30) return "desert";
    if (humidity > 0.56) return "forest";
    return "grass";
  }

  function generateLandforms(seed) {
    const main = {
      x: W / 2 + (seededHash(3, 7, seed) - 0.5) * 7,
      y: H / 2 + (seededHash(11, 5, seed) - 0.5) * 7,
      rx: W * 0.34 + seededHash(13, 17, seed) * 5,
      ry: H * 0.29 + seededHash(19, 23, seed) * 5,
      angle: (seededHash(29, 31, seed) - 0.5) * 0.42
    };
    const forms = [main];
    const count = 5 + Math.floor(seededHash(37, 41, seed) * 3);
    const phase = seededHash(43, 47, seed) * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      const angle = phase + i * Math.PI * 2 / count;
      const distance = W * 0.31 + seededHash(i + 51, i + 61, seed) * 10;
      forms.push({
        x: Math.max(3, Math.min(W - 4, main.x + Math.cos(angle) * distance)),
        y: Math.max(3, Math.min(H - 4, main.y + Math.sin(angle) * distance * 0.78)),
        rx: 5.5 + seededHash(i + 67, i + 71, seed) * 5.5,
        ry: 4.8 + seededHash(i + 73, i + 79, seed) * 5,
        angle: (seededHash(i + 83, i + 89, seed) - 0.5) * 0.8
      });
    }
    return forms;
  }

  function landScoreAt(x, y, forms, seed) {
    let score = -1;
    for (const form of forms) {
      const dx = x - form.x;
      const dy = y - form.y;
      const cos = Math.cos(form.angle);
      const sin = Math.sin(form.angle);
      const rx = (dx * cos + dy * sin) / form.rx;
      const ry = (-dx * sin + dy * cos) / form.ry;
      const distance = Math.sqrt(rx * rx + ry * ry);
      score = Math.max(score, 1 - distance);
    }
    const broad = (fractalNoise(x / 5.8, y / 5.8, seed + 137) - 0.5) * 0.42;
    const fine = (fractalNoise(x / 2.6, y / 2.6, seed + 181) - 0.5) * 0.12;
    return score + broad + fine - 0.035;
  }

  function carveRiver(tiles, startX, startY, direction, seed) {
    let x = startX;
    let y = startY;
    let outsideWater = 0;
    const horizontal = direction === "east" || direction === "west";
    const sign = direction === "east" || direction === "south" ? 1 : -1;

    for (let step = 0; step < Math.max(W, H) * 1.5; step++) {
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) break;
      if (tiles[y][x].type === "water" && step > 3) {
        outsideWater++;
        if (outsideWater >= 2) break;
      } else {
        outsideWater = 0;
      }

      tiles[y][x].type = "water";
      if (seededHash(step + 3, startX + 7, seed) > 0.86) {
        const side = seededHash(step + 11, startY + 13, seed) > 0.5 ? 1 : -1;
        const bx = horizontal ? x : x + side;
        const by = horizontal ? y + side : y;
        if (bx > 0 && by > 0 && bx < W - 1 && by < H - 1) tiles[by][bx].type = "water";
      }

      if (horizontal) {
        x += sign;
        const turn = seededHash(step + 17, startY, seed);
        if (turn > 0.62) y += turn > 0.81 ? 1 : -1;
      } else {
        y += sign;
        const turn = seededHash(step + 23, startX, seed);
        if (turn > 0.62) x += turn > 0.81 ? 1 : -1;
      }
    }
  }

  function addLakes(tiles, seed) {
    const count = 5 + Math.floor(seededHash(97, 103, seed) * 4);
    for (let i = 0; i < count; i++) {
      const cx = 10 + Math.floor(seededHash(i + 107, 17, seed) * (W - 20));
      const cy = 10 + Math.floor(seededHash(29, i + 109, seed) * (H - 20));
      if (Math.abs(cx - W / 2) + Math.abs(cy - H / 2) < 18) continue;
      const radius = 1.5 + seededHash(i + 113, 31, seed) * 1.7;
      for (let y = Math.max(1, Math.floor(cy - radius - 1)); y <= Math.min(H - 2, Math.ceil(cy + radius + 1)); y++) {
        for (let x = Math.max(1, Math.floor(cx - radius - 1)); x <= Math.min(W - 2, Math.ceil(cx + radius + 1)); x++) {
          const dx = (x - cx) / radius;
          const dy = (y - cy) / (radius * 0.82);
          const edge = (fractalNoise(x / 2.4, y / 2.4, seed + i * 19) - 0.5) * 0.34;
          if (dx * dx + dy * dy < 1 + edge) tiles[y][x].type = "water";
        }
      }
    }
  }

  function drawTerrainDetail(ctx, tile, x, y, cell) {
    if (cell < 13) return;
    const cx = x + cell / 2;
    const cy = y + cell / 2;
    const detail = seededHash(tile.x, tile.y, 991);

    if (tile.type === "forest") {
      ctx.fillStyle = "#294d35";
      ctx.beginPath();
      ctx.moveTo(cx, y + cell * 0.16);
      ctx.lineTo(x + cell * 0.23, y + cell * 0.72);
      ctx.lineTo(x + cell * 0.77, y + cell * 0.72);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#203f2d";
      ctx.beginPath();
      ctx.moveTo(x + cell * 0.34, y + cell * 0.27);
      ctx.lineTo(x + cell * 0.12, y + cell * 0.78);
      ctx.lineTo(x + cell * 0.56, y + cell * 0.78);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#9a7950";
      ctx.fillRect(cx - cell * 0.035, y + cell * 0.68, cell * 0.07, cell * 0.18);
    } else if (tile.type === "mountain") {
      ctx.fillStyle = "#434c52";
      ctx.beginPath();
      ctx.moveTo(x + cell * 0.12, y + cell * 0.83);
      ctx.lineTo(x + cell * 0.51, y + cell * 0.13);
      ctx.lineTo(x + cell * 0.9, y + cell * 0.83);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#d5dcda";
      ctx.beginPath();
      ctx.moveTo(x + cell * 0.39, y + cell * 0.35);
      ctx.lineTo(x + cell * 0.51, y + cell * 0.13);
      ctx.lineTo(x + cell * 0.65, y + cell * 0.39);
      ctx.lineTo(x + cell * 0.53, y + cell * 0.34);
      ctx.lineTo(x + cell * 0.47, y + cell * 0.46);
      ctx.closePath(); ctx.fill();
    } else if (tile.type === "rock") {
      ctx.fillStyle = "#555750";
      ctx.fillRect(x + cell * 0.22, y + cell * (0.48 + detail * 0.12), cell * 0.2, cell * 0.18);
      ctx.fillRect(x + cell * 0.57, y + cell * 0.35, cell * 0.22, cell * 0.25);
      ctx.fillStyle = "#a19f91";
      ctx.fillRect(x + cell * 0.25, y + cell * 0.48, cell * 0.14, cell * 0.045);
    } else if (tile.type === "desert") {
      ctx.strokeStyle = "#d4bd7c";
      ctx.lineWidth = Math.max(1, cell * 0.035);
      ctx.beginPath();
      ctx.moveTo(x + cell * 0.12, y + cell * 0.68);
      ctx.quadraticCurveTo(cx, y + cell * (0.55 + detail * 0.12), x + cell * 0.88, y + cell * 0.68);
      ctx.stroke();
      ctx.fillStyle = "#806d45";
      ctx.fillRect(x + cell * 0.7, y + cell * 0.28, cell * 0.05, cell * 0.05);
    } else if (tile.type === "tundra") {
      ctx.strokeStyle = "#dce8e8";
      ctx.lineWidth = Math.max(1, cell * 0.035);
      ctx.beginPath();
      ctx.moveTo(x + cell * 0.25, y + cell * 0.34);
      ctx.lineTo(x + cell * 0.42, y + cell * 0.5);
      ctx.lineTo(x + cell * 0.34, y + cell * 0.68);
      ctx.moveTo(x + cell * 0.42, y + cell * 0.5);
      ctx.lineTo(x + cell * 0.62, y + cell * 0.39);
      ctx.stroke();
    } else if (tile.type === "swamp") {
      ctx.strokeStyle = "#354d3d";
      ctx.lineWidth = Math.max(1, cell * 0.045);
      ctx.beginPath();
      ctx.moveTo(cx, y + cell * 0.82);
      ctx.lineTo(cx - cell * 0.08, y + cell * 0.37);
      ctx.moveTo(cx, y + cell * 0.65);
      ctx.lineTo(cx + cell * 0.18, y + cell * 0.29);
      ctx.stroke();
    } else if (tile.type === "water") {
      ctx.strokeStyle = "#77a8bd";
      ctx.globalAlpha = 0.52;
      ctx.lineWidth = Math.max(1, cell * 0.035);
      ctx.beginPath();
      ctx.moveTo(x + cell * 0.16, y + cell * 0.38);
      ctx.lineTo(x + cell * 0.44, y + cell * 0.38);
      ctx.moveTo(x + cell * 0.52, y + cell * 0.68);
      ctx.lineTo(x + cell * 0.84, y + cell * 0.68);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = "#9bad69";
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x + cell * (0.2 + detail * 0.55), y + cell * 0.25, Math.max(1, cell * 0.05), Math.max(1, cell * 0.05));
      ctx.globalAlpha = 1;
    }
  }

  const colors = {
    water: "#315b76",
    rock: "#77766f",
    forest: "#456344",
    grass: "#778b55",
    mountain: "#626b70",
    desert: "#b69a5c",
    tundra: "#9aa9ad",
    swamp: "#596f5a"
  };
  const names = {
    water: "Вода", rock: "Скалы", forest: "Лес", grass: "Равнина",
    mountain: "Горы", desert: "Пустыня", tundra: "Тундра", swamp: "Болото"
  };
  const descriptions = {
    water: "Река, озеро или море. Вода разделяет территории и формирует естественные границы.",
    rock: "Каменистые холмы. Подходят для добычи строительного камня.",
    forest: "Лесной биом. Здесь можно строить лесопилки и добывать древесину.",
    grass: "Равнины. Благоприятная местность для городов, жилья и сельского хозяйства.",
    mountain: "Горный массив. Сложный рельеф с богатыми залежами камня.",
    desert: "Засушливые земли. Здесь мало растительности и сложнее развивать сельское хозяйство.",
    tundra: "Холодный северный биом с редкой растительностью.",
    swamp: "Влажная низменность. Труднопроходимая местность с густой растительностью."
  };

  C.world = {
    width: W,
    height: H,
    tiles: [],
    colors: colors,
    names: names,
    descriptions: descriptions,

    seed: 0,

    init: function (options) {
      const settings = options || {};
      this.seed = Number.isFinite(settings.seed) ? settings.seed : Math.floor(Math.random() * 900000000) + 100000;
      this.tiles = [];
      const landforms = generateLandforms(this.seed);
      for (let y = 0; y < H; y++) {
        const row = [];
        for (let x = 0; x < W; x++) {
          const score = landScoreAt(x, y, landforms, this.seed);
          row.push({ x: x, y: y, type: terrain(x, y, this.seed, score), road: false, owner: null });
        }
        this.tiles.push(row);
      }

      // A pair of narrow rivers flows from the central highlands toward nearby coasts.
      carveRiver(this.tiles, Math.floor(W / 2) - 22, Math.floor(H / 2) - 8, "east", this.seed + 307);
      carveRiver(this.tiles, Math.floor(W / 2) + 20, Math.floor(H / 2) + 9, "west", this.seed + 419);
      addLakes(this.tiles, this.seed);

      // Guarantee a safe fertile founding zone in the center of the larger world.
      const startX = Math.floor(W / 2);
      const startY = Math.floor(H / 2);
      for (let y = startY - 6; y <= startY + 6; y++) {
        for (let x = startX - 6; x <= startX + 6; x++) {
          if (Math.abs(x - startX) + Math.abs(y - startY) <= 8) this.tiles[y][x].type = "grass";
        }
      }

      // A guaranteed nearby woodland ring gives the first settlement access to timber.
      for (let y = startY - 15; y <= startY + 15; y++) {
        for (let x = startX - 15; x <= startX + 15; x++) {
          const distance = Math.hypot(x - startX, y - startY);
          const patch = fractalNoise(x / 3.4, y / 3.4, this.seed + 1201);
          const tile = this.tiles[y] && this.tiles[y][x];
          if (!tile || distance < 8.5 || distance > 15 || tile.type === "water") continue;
          if (patch > 0.43) tile.type = "forest";
        }
      }

      // Keep a few open grass corridors between the settlement and nearby forest.
      for (let y = startY - 9; y <= startY + 9; y++) {
        for (let x = startX - 9; x <= startX + 9; x++) {
          if (Math.hypot(x - startX, y - startY) < 9) this.tiles[y][x].type = "grass";
        }
      }
      this.updateCoasts();
    },

    exportData: function () {
      return {
        version: 2,
        seed: this.seed,
        tiles: this.tiles.map(row => row.map(tile => tile.type))
      };
    },

    importData: function (data) {
      if (!data || !Array.isArray(data.tiles) || !data.tiles.length || data.tiles.length > H) return false;
      const allowed = Object.keys(colors);
      if (!data.tiles.every(row => Array.isArray(row) && row.length > 0 && row.length <= W &&
          row.every(type => allowed.includes(type)))) return false;
      this.seed = Number(data.seed) || this.seed;
      // Older 48x48 saves are preserved in the upper-left of the expanded world.
      // Newly generated terrain remains around the old map, so old settlements are not discarded.
      for (let y = 0; y < data.tiles.length; y++) {
        for (let x = 0; x < data.tiles[y].length; x++) this.tiles[y][x].type = data.tiles[y][x];
      }
      this.updateCoasts();
      return true;
    },

    prepareForLegacySave: function (data) {
      if (!data) return;
      const sites = [];
      (Array.isArray(data.buildings) ? data.buildings : []).forEach(item => {
        const definition = item && C.buildings && C.buildings.catalog[item.type];
        const tile = item && this.get(item.x, item.y);
        if (!tile || !definition) return;
        if (!definition.terrain.includes(tile.type)) {
          const preferred = item.type === "lumber" ? "forest" :
            item.type === "quarry" ? "rock" : "grass";
          tile.type = definition.terrain.includes(preferred) ? preferred : definition.terrain[0];
        }
        sites.push(tile);
      });
      const center = data.city && data.city.center;
      if (center) {
        const tile = this.get(center.x, center.y);
        if (tile && tile.type !== "grass") tile.type = "grass";
      }
      (Array.isArray(data.roads) ? data.roads : []).forEach(point => {
        const tile = point && this.get(point.x, point.y);
        if (tile && tile.type === "water") tile.type = "grass";
      });
      const countries = data.politics && Array.isArray(data.politics.countries) ? data.politics.countries : [];
      countries.forEach(country => {
        const points = [country.capital].concat(Array.isArray(country.settlements) ? country.settlements : []);
        points.forEach(point => {
          const tile = point && this.get(point.x, point.y);
          if (tile && tile.type === "water") tile.type = "grass";
        });
      });
      this.updateCoasts();
    },

    updateCoasts: function () {
      const directions = [
        ["north", 0, -1], ["east", 1, 0],
        ["south", 0, 1], ["west", -1, 0]
      ];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const tile = this.tiles[y][x];
          const edges = {};
          let coast = false;
          directions.forEach(([name, dx, dy]) => {
            const neighbor = this.get(x + dx, y + dy);
            // Shoreline belongs to land tiles only; water must never receive sand.
            edges[name] = tile.type !== "water" && !!(neighbor && neighbor.type === "water");
            if (edges[name]) coast = true;
          });
          tile.coast = coast;
          tile.coastEdges = edges;
        }
      }
    },

    get: function (x, y) {
      return x >= 0 && y >= 0 && x < W && y < H ? this.tiles[y][x] : null;
    },

    draw: function (ctx) {
      const camera = C.state.camera;
      const zoom = camera.zoom;
      const cell = C.camera.cell * zoom;

      ctx.save();
      ctx.setTransform(C.camera.dpr, 0, 0, C.camera.dpr, 0, 0);
      ctx.clearRect(0, 0, C.camera.width, C.camera.height);
      ctx.fillStyle = "#172129";
      ctx.fillRect(0, 0, C.camera.width, C.camera.height);

      const x0 = Math.max(0, Math.floor(-camera.x / cell));
      const y0 = Math.max(0, Math.floor(-camera.y / cell));
      const x1 = Math.min(W, Math.ceil((C.camera.width - camera.x) / cell));
      const y1 = Math.min(H, Math.ceil((C.camera.height - camera.y) / cell));

      // Pre-index countries and settlements once per draw, not once per map tile.
      const ownerColors = new Map();
      const settlementMarkers = new Map();
      if (C.politics) {
        for (const country of C.politics.countries) {
          ownerColors.set(country.id, country.color || "#ffffff");
          const settlements = country.settlements || [{ x: country.capital.x, y: country.capital.y }];
          for (let i = 0; i < settlements.length; i++) {
            const point = settlements[i];
            const key = point.x + "," + point.y;
            if (!settlementMarkers.has(key)) settlementMarkers.set(key, []);
            settlementMarkers.get(key).push({ country: country, index: i });
          }
        }
      }
      const political = !!C.state.showPoliticalMap;
      const borders = political && C.state.showCountryBorders !== false;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const tile = this.tiles[y][x];
          const sx = camera.x + x * cell;
          const sy = camera.y + y * cell;
          ctx.fillStyle = colors[tile.type];
          ctx.fillRect(sx, sy, cell + 0.4, cell + 0.4);
          // The pixel-art renderer owns terrain object details; avoid drawing legacy tile icons beneath sprites.
          if (!C.pixelArt || !C.pixelArt.enabled) drawTerrainDetail(ctx, tile, sx, sy, cell);

          if (C.state.showPoliticalMap && tile.owner) {
            const ownerColor = tile.owner === "player" ? "#e2b45c" :
              (ownerColors.get(tile.owner) || "#ffffff");
            ctx.fillStyle = ownerColor;
            ctx.globalAlpha = 0.19;
            ctx.fillRect(sx, sy, cell + 0.4, cell + 0.4);
            ctx.globalAlpha = 1;
            if (borders) {
              const east = this.get(x + 1, y);
              const south = this.get(x, y + 1);
              ctx.strokeStyle = ownerColor;
              ctx.globalAlpha = 0.8;
              ctx.lineWidth = Math.max(1, cell * 0.055);
              ctx.beginPath();
              if (!east || east.owner !== tile.owner) { ctx.moveTo(sx + cell, sy); ctx.lineTo(sx + cell, sy + cell); }
              if (!south || south.owner !== tile.owner) { ctx.moveTo(sx, sy + cell); ctx.lineTo(sx + cell, sy + cell); }
              ctx.stroke();
              ctx.globalAlpha = 1;
            }
          }

          if (tile.road) {
            const roadWidth = Math.max(3, cell * 0.23);
            const half = roadWidth / 2;
            const centerX = sx + cell / 2;
            const centerY = sy + cell / 2;
            ctx.fillStyle = "#b39a69";
            ctx.fillRect(centerX - half, centerY - half, roadWidth, roadWidth);
            const east = this.get(x + 1, y);
            const west = this.get(x - 1, y);
            const south = this.get(x, y + 1);
            const north = this.get(x, y - 1);
            if (east && (east.road || east.building)) {
              ctx.fillRect(centerX, centerY - half, cell / 2 + 1, roadWidth);
            }
            if (west && (west.road || west.building)) {
              ctx.fillRect(sx, centerY - half, cell / 2 + 1, roadWidth);
            }
            if (south && (south.road || south.building)) {
              ctx.fillRect(centerX - half, centerY, roadWidth, cell / 2 + 1);
            }
            if (north && (north.road || north.building)) {
              ctx.fillRect(centerX - half, sy, roadWidth, cell / 2 + 1);
            }
          }

          if (political) {
            const markers = settlementMarkers.get(x + "," + y);
            if (markers) for (const marker of markers) {
              const country = marker.country;
              const index = marker.index;
              const cx = sx + cell / 2;
              const cy = sy + cell / 2;
              if (index === 0) {
                ctx.fillStyle = "#fff4d6";
                ctx.font = "bold " + Math.max(10, cell * 0.58) + "px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(country.flag, cx, cy);
                if (zoom >= 0.82) {
                  const labelY = cy - Math.max(9, cell * 0.42);
                  ctx.font = "bold " + Math.max(8, Math.min(12, cell * 0.25)) + "px Arial";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "bottom";
                  ctx.lineWidth = 3;
                  ctx.strokeStyle = "#111820";
                  ctx.strokeText(country.name, cx, labelY, Math.max(54, cell * 5));
                  ctx.fillStyle = "#fff4d6";
                  ctx.fillText(country.name, cx, labelY, Math.max(54, cell * 5));
                }
              } else {
                ctx.fillStyle = country.color;
                ctx.beginPath();
                ctx.arc(cx, cy, Math.max(2, cell * 0.16), 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "#fff4d6";
                ctx.lineWidth = 1;
                ctx.stroke();
              }
            }
          }

          if (tile.building && (!C.pixelArt || !C.pixelArt.enabled)) {
            const symbols = {
              city_center: "⌂",
              house: "⌂",
              farm: "♧",
              lumber: "♜",
              quarry: "◆",
              warehouse: "▣"
            };
            ctx.fillStyle = "#f4e5bd";
            ctx.font = "bold " + Math.max(10, cell * 0.62) + "px Arial";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(symbols[tile.building.type] || "•", sx + cell / 2, sy + cell / 2);
          }

          if (zoom > 0.8 && (!C.pixelArt || !C.pixelArt.enabled)) {
            ctx.fillStyle = tile.type === "water" ? "#ffffff0a" : "#ffffff0b";
            ctx.fillRect(sx + cell * 0.18, sy + cell * 0.18, cell * 0.12, cell * 0.12);
          }
        }
      }

      if (C.state.showTradeRoutes && C.trade && C.trade.routes.length) {
        ctx.save();
        ctx.strokeStyle = "#f2d17b";
        ctx.lineWidth = Math.max(2, cell * 0.12);
        ctx.globalAlpha = 0.9;
        if (ctx.setLineDash) ctx.setLineDash([Math.max(3, cell * 0.22), Math.max(3, cell * 0.16)]);
        C.trade.routes.forEach(route => {
          if (!route.points || route.points.length < 2) return;
          ctx.beginPath();
          route.points.forEach((point, index) => {
            const px = camera.x + (point.x + 0.5) * cell;
            const py = camera.y + (point.y + 0.5) * cell;
            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
        });
        ctx.restore();
      }

      ctx.restore();
    },

    drawMini: function (ctx) {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      const cellWidth = ctx.canvas.width / W;
      const cellHeight = ctx.canvas.height / H;

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const tile = this.tiles[y][x];
          ctx.fillStyle = colors[tile.type];
          ctx.fillRect(x * cellWidth, y * cellHeight, Math.ceil(cellWidth), Math.ceil(cellHeight));
          if (C.state.showPoliticalMap && tile.owner) {
            const ownerColor = tile.owner === "player" ? "#e2b45c" :
              (C.politics && C.politics.get(tile.owner) ? C.politics.get(tile.owner).color : "#ffffff");
            ctx.fillStyle = ownerColor;
            ctx.globalAlpha = 0.48;
            ctx.fillRect(x * cellWidth, y * cellHeight, Math.ceil(cellWidth), Math.ceil(cellHeight));
            ctx.globalAlpha = 1;
          }
          if (tile.road) {
            ctx.fillStyle = "#d0b47e";
            ctx.fillRect(x * cellWidth, y * cellHeight, Math.max(1, cellWidth), Math.max(1, cellHeight));
          }
          if (tile.building) {
            ctx.fillStyle = "#f4e5bd";
            ctx.fillRect(x * cellWidth, y * cellHeight, Math.max(1, cellWidth), Math.max(1, cellHeight));
          }
        }
      }

      const camera = C.state.camera;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        Math.max(0, -camera.x / (C.camera.cell * camera.zoom) * cellWidth),
        Math.max(0, -camera.y / (C.camera.cell * camera.zoom) * cellHeight),
        Math.min(ctx.canvas.width, C.camera.width / (C.camera.cell * camera.zoom) * cellWidth),
        Math.min(ctx.canvas.height, C.camera.height / (C.camera.cell * camera.zoom) * cellHeight)
      );
    }
  };

})();