(function () {
  "use strict";
  const C = window.Civ;
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  C.infrastructure = {
    roadCount: 0,
    connectedBuildings: 0,
    baseStorage: 300,
    connectedRoads: new Set(),

    updateNetwork: function () {
      const roads = this.connectedRoads;
      roads.clear();
      this.roadCount = 0;
      this.connectedBuildings = 0;

      for (const row of C.world.tiles) {
        for (const tile of row) {
          if (tile.road) this.roadCount++;
        }
      }

      if (C.city && C.city.center) {
        const queue = [];
        const addRoad = (x, y) => {
          const tile = C.world.get(x, y);
          if (!tile || !tile.road) return;
          const id = x + "," + y;
          if (roads.has(id)) return;
          roads.add(id);
          queue.push({ x: x, y: y });
        };

        for (const direction of directions) {
          addRoad(C.city.center.x + direction[0], C.city.center.y + direction[1]);
        }

        for (let i = 0; i < queue.length; i++) {
          const point = queue[i];
          for (const direction of directions) {
            addRoad(point.x + direction[0], point.y + direction[1]);
          }
        }

        for (const row of C.world.tiles) {
          for (const tile of row) {
            if (!tile.building || tile.building.type === "city_center") continue;
            if (this.isConnected(tile.x, tile.y)) this.connectedBuildings++;
          }
        }
      }

      C.emit("infrastructure");
      return roads.size;
    },

    isConnected: function (x, y) {
      if (!C.city || !C.city.center) return false;
      const center = C.city.center;
      if (Math.abs(center.x - x) + Math.abs(center.y - y) === 1) return true;
      for (const direction of directions) {
        if (this.connectedRoads.has((x + direction[0]) + "," + (y + direction[1]))) return true;
      }
      return false;
    },

    efficiency: function (x, y) {
      return this.isConnected(x, y) ? 1 : 0.5;
    },

    storageCapacity: function () {
      let warehouses = 0;
      for (const row of C.world.tiles) {
        for (const tile of row) {
          if (!tile.building) continue;
          const definition = C.buildings.catalog[tile.building.type];
          if (definition) warehouses += definition.storage || 0;
        }
      }
      return this.baseStorage + warehouses;
    },

    roadUpkeep: function () {
      return Math.round(this.roadCount * 0.05 * 100) / 100;
    },

    buildRoad: function (x, y) {
      const tile = C.world.get(x, y);
      if (!tile) return { ok: false, message: "Клетка находится за пределами карты." };
      if (tile.type === "water") return { ok: false, message: "Дорогу нельзя проложить через воду." };
      if (tile.building) return { ok: false, message: "На клетке уже стоит здание." };
      if (tile.road) return { ok: false, message: "На этой клетке уже есть дорога." };

      const resources = C.state.resources;
      if (resources.wood < 3 || resources.money < 2) {
        return { ok: false, message: "Для дороги нужно 3 дерева и 2 монеты." };
      }

      resources.wood -= 3;
      resources.money -= 2;
      tile.road = true;
      this.updateNetwork();
      C.emit("resources");
      C.emit("world");
      C.log("Построена дорога. Стоимость: 3 дерева и 2 монеты.");
      return { ok: true, message: "Дорога построена." };
    }
  };
})();