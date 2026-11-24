(function () {
  "use strict";
  const C = window.Civ;
  const W = 48;
  const H = 48;

  function hash(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function terrain(x, y) {
    const n = hash(x, y);
    const wave = Math.sin(x * 0.19) + Math.cos(y * 0.16);
    if (n > 0.83 || wave > 1.55) return "water";
    if (n > 0.72) return "rock";
    if (n > 0.48) return "forest";
    return "grass";
  }

  const colors = {
    water: "#315b76",
    rock: "#77766f",
    forest: "#456344",
    grass: "#778b55"
  };
  const names = { water: "Вода", rock: "Скалы", forest: "Лес", grass: "Равнина" };
  const descriptions = {
    water: "Водоём. Может стать источником рыбы и частью торговых путей.",
    rock: "Каменистая местность. Подходит для добычи строительного камня.",
    forest: "Лесная местность. Здесь можно добывать древесину.",
    grass: "Равнина. Подходит для размещения поселений и сельского хозяйства."
  };
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  C.world = {
    width: W,
    height: H,
    tiles: [],
    colors: colors,
    names: names,
    descriptions: descriptions,

    init: function () {
      this.tiles = [];
      for (let y = 0; y < H; y++) {
        const row = [];
        for (let x = 0; x < W; x++) {
          row.push({ x: x, y: y, type: terrain(x, y), road: false });
        }
        this.tiles.push(row);
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

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const tile = this.tiles[y][x];
          const sx = camera.x + x * cell;
          const sy = camera.y + y * cell;
          ctx.fillStyle = colors[tile.type];
          ctx.fillRect(sx, sy, cell + 0.4, cell + 0.4);

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

  C.world.init();
})();