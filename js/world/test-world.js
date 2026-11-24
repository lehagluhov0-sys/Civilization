(function () {
  "use strict";
  const C = window.Civ;
  const W = 48;
  const H = 48;

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

  function terrain(x, y, seed) {
    const elevation = fractalNoise(x / 10.5, y / 10.5, seed) * 0.72 +
      valueNoise(x / 4.4, y / 4.4, seed + 31) * 0.28;
    const humidity = fractalNoise(x / 8.2 + 18, y / 8.2 - 9, seed + 47);
    const temperature = 0.9 - Math.abs(y / (H - 1) - 0.5) * 1.65 +
      fractalNoise(x / 15 + 3, y / 15 + 20, seed + 71) * 0.12;

    if (elevation < 0.39) return "water";
    if (temperature < 0.28) return "tundra";
    if (elevation > 0.73) return "mountain";
    if (elevation > 0.64) return "rock";
    if (humidity > 0.73 && elevation < 0.59) return "swamp";
    if (temperature > 0.58 && humidity < 0.31) return "desert";
    if (humidity > 0.56) return "forest";
    return "grass";
  }

  function addRiver(tiles, startY, slope, amplitude, phase) {
    for (let x = 0; x < W; x++) {
      const centerY = startY + slope * (x - W / 2) +
        Math.sin(x * 0.23 + phase) * amplitude +
        Math.sin(x * 0.47 + phase * 0.7) * 0.8;
      for (let y = Math.floor(centerY - 0.75); y <= Math.ceil(centerY + 0.75); y++) {
        if (y >= 0 && y < H) tiles[y][x].type = "water";
      }
    }
  }

  function addLakes(tiles, seed) {
    for (let i = 0; i < 3; i++) {
      const cx = 7 + Math.floor(seededHash(i + 3, 17, seed + 101) * 34);
      const cy = 7 + Math.floor(seededHash(29, i + 5, seed + 107) * 34);
      if (Math.abs(cx - 24) + Math.abs(cy - 24) < 8) continue;
      const radius = 1.4 + seededHash(i + 13, 31, seed + 113) * 1.2;
      for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(H - 1, Math.ceil(cy + radius)); y++) {
        for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(W - 1, Math.ceil(cx + radius)); x++) {
          const dx = (x - cx) / radius;
          const dy = (y - cy) / (radius * 0.82);
          if (dx * dx + dy * dy < 1) tiles[y][x].type = "water";
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
      for (let y = 0; y < H; y++) {
        const row = [];
        for (let x = 0; x < W; x++) {
          row.push({ x: x, y: y, type: terrain(x, y, this.seed), road: false, owner: null });
        }
        this.tiles.push(row);
      }

      addRiver(this.tiles, 17, 0.24, 2.6, 0.8);
      addRiver(this.tiles, 34, -0.25, 2.8, 2.4);
      addLakes(this.tiles, this.seed);

      // Keep a small fertile starting region near the centre of the world.
      for (let y = 21; y <= 27; y++) {
        for (let x = 21; x <= 27; x++) {
          if (Math.abs(x - 24) + Math.abs(y - 24) <= 4) this.tiles[y][x].type = "grass";
        }
      }
    },

    exportData: function () {
      return {
        version: 2,
        seed: this.seed,
        tiles: this.tiles.map(row => row.map(tile => tile.type))
      };
    },

    importData: function (data) {
      if (!data || !Array.isArray(data.tiles) || data.tiles.length !== H) return false;
      const allowed = Object.keys(colors);
      if (!data.tiles.every(row => Array.isArray(row) && row.length === W &&
          row.every(type => allowed.includes(type)))) return false;
      this.seed = Number(data.seed) || this.seed;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) this.tiles[y][x].type = data.tiles[y][x];
      }
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
        if (tile && tile.type === "water") tile.type = "grass";
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

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const tile = this.tiles[y][x];
          const sx = camera.x + x * cell;
          const sy = camera.y + y * cell;
          ctx.fillStyle = colors[tile.type];
          ctx.fillRect(sx, sy, cell + 0.4, cell + 0.4);
          drawTerrainDetail(ctx, tile, sx, sy, cell);

          if (C.state.showPoliticalMap && tile.owner) {
            const ownerColor = tile.owner === "player" ? "#e2b45c" :
              (C.politics && C.politics.get(tile.owner) ? C.politics.get(tile.owner).color : "#ffffff");
            ctx.fillStyle = ownerColor;
            ctx.globalAlpha = 0.19;
            ctx.fillRect(sx, sy, cell + 0.4, cell + 0.4);
            ctx.globalAlpha = 1;
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

          if (C.state.showPoliticalMap && C.politics) {
            C.politics.countries.forEach(country => {
              (country.settlements || [{ x: country.capital.x, y: country.capital.y }]).forEach((city, index) => {
                if (city.x !== x || city.y !== y) return;
                const cx = sx + cell / 2;
                const cy = sy + cell / 2;
                if (index === 0) {
                  ctx.fillStyle = "#fff4d6";
                  ctx.font = "bold " + Math.max(10, cell * 0.58) + "px Arial";
                  ctx.textAlign = "center";
                  ctx.textBaseline = "middle";
                  ctx.fillText(country.flag, cx, cy);
                } else {
                  ctx.fillStyle = country.color;
                  ctx.beginPath();
                  ctx.arc(cx, cy, Math.max(2, cell * 0.16), 0, Math.PI * 2);
                  ctx.fill();
                  ctx.strokeStyle = "#fff4d6";
                  ctx.lineWidth = 1;
                  ctx.stroke();
                }
              });
            });
          }

          if (tile.building) {
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

          if (zoom > 0.8) {
            ctx.fillStyle = tile.type === "water" ? "#ffffff0a" : "#ffffff0b";
            ctx.fillRect(sx + cell * 0.18, sy + cell * 0.18, cell * 0.12, cell * 0.12);
          }
        }
      }

      if (C.state.showGrid && zoom > 0.65) {
        ctx.strokeStyle = "#17212966";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = x0; x <= x1; x++) {
          ctx.moveTo(camera.x + x * cell, camera.y + y0 * cell);
          ctx.lineTo(camera.x + x * cell, camera.y + y1 * cell);
        }
        for (let y = y0; y <= y1; y++) {
          ctx.moveTo(camera.x + x0 * cell, camera.y + y * cell);
          ctx.lineTo(camera.x + x1 * cell, camera.y + y * cell);
        }
        ctx.stroke();
      }

      if (C.state.selected) {
        const selected = C.state.selected;
        ctx.strokeStyle = "#f1c36e";
        ctx.lineWidth = 2;
        ctx.strokeRect(
          camera.x + selected.x * cell + 1,
          camera.y + selected.y * cell + 1,
          cell - 2,
          cell - 2
        );
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