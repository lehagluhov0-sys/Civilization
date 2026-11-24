(function () {
  "use strict";
  const C = window.Civ;
  const STORAGE_KEY = "civilization_save_v1";
  const SAVE_VERSION = 1;
  let saveTimer = null;

  function validPoint(point) {
    return point && Number.isInteger(point.x) && Number.isInteger(point.y) &&
      point.x >= 0 && point.y >= 0 &&
      point.x < C.world.width && point.y < C.world.height;
  }

  C.save = {
    loaded: false,
    lastSavedAt: null,

    save: function () {
      try {
        const buildings = [];
        const roads = [];
        for (const row of C.world.tiles) {
          for (const tile of row) {
            if (tile.building) buildings.push({
              x: tile.x,
              y: tile.y,
              type: tile.building.type
            });
            if (tile.road) roads.push({ x: tile.x, y: tile.y });
          }
        }

        const data = {
          version: SAVE_VERSION,
          savedAt: Date.now(),
          state: {
            day: C.state.day,
            seasonIndex: C.state.seasonIndex,
            year: C.state.year || 1,
            paused: C.state.paused,
            speed: C.state.speed,
            showGrid: C.state.showGrid,
            resources: Object.assign({}, C.state.resources),
            camera: Object.assign({}, C.state.camera),
            selected: C.state.selected ? {
              x: C.state.selected.x,
              y: C.state.selected.y
            } : null
          },
          city: {
            population: C.city.population,
            center: C.city.center ? {
              x: C.city.center.x,
              y: C.city.center.y
            } : null
          },
          economy: { taxRate: C.economy.taxRate },
          buildings: buildings,
          roads: roads
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        this.lastSavedAt = data.savedAt;
        return true;
      } catch (error) {
        console.warn("Не удалось сохранить Civilization:", error);
        return false;
      }
    },

    load: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || data.version !== SAVE_VERSION || !data.state ||
            !Array.isArray(data.buildings) || !Array.isArray(data.roads)) {
          console.warn("Сохранение Civilization имеет неподдерживаемый формат.");
          return false;
        }

        const savedState = data.state;
        if (savedState.resources && typeof savedState.resources === "object") {
          ["population", "money", "food", "wood", "stone"].forEach(key => {
            const value = Number(savedState.resources[key]);
            if (Number.isFinite(value) && value >= 0) C.state.resources[key] = value;
          });
        }

        C.state.day = Math.max(1, Math.min(30, Number(savedState.day) || 1));
        C.state.seasonIndex = Math.max(0, Math.min(3, Number(savedState.seasonIndex) || 0));
        C.state.year = Math.max(1, Number(savedState.year) || 1);
        C.state.paused = savedState.paused !== false;
        C.state.speed = [1, 2, 4].includes(Number(savedState.speed)) ? Number(savedState.speed) : 1;
        C.state.showGrid = savedState.showGrid !== false;

        if (savedState.camera && Number.isFinite(savedState.camera.x) &&
            Number.isFinite(savedState.camera.y) && Number.isFinite(savedState.camera.zoom)) {
          C.state.camera.x = savedState.camera.x;
          C.state.camera.y = savedState.camera.y;
          C.state.camera.zoom = Math.max(0.45, Math.min(2.5, savedState.camera.zoom));
        }

        C.state.selected = validPoint(savedState.selected) ? savedState.selected : null;
        C.city.population = Math.max(10, Number(data.city && data.city.population) || 120);
        C.state.resources.population = C.city.population;
        C.city.center = validPoint(data.city && data.city.center) ? data.city.center : null;

        data.roads.forEach(point => {
          if (!validPoint(point)) return;
          const tile = C.world.get(point.x, point.y);
          if (tile && tile.type !== "water" && !tile.building) tile.road = true;
        });

        data.buildings.forEach(item => {
          if (!validPoint(item) || !C.buildings.catalog[item.type]) return;
          const tile = C.world.get(item.x, item.y);
          if (tile && C.buildings.catalog[item.type].terrain.includes(tile.type)) {
            tile.building = { type: item.type, workers: 0 };
            tile.road = false;
            if (item.type === "city_center") C.city.center = { x: item.x, y: item.y };
          }
        });

        const taxRate = Number(data.economy && data.economy.taxRate);
        if (Number.isFinite(taxRate)) C.economy.taxRate = Math.max(0, Math.min(30, taxRate));
        this.loaded = true;
        this.lastSavedAt = Number(data.savedAt) || null;
        return true;
      } catch (error) {
        console.warn("Не удалось загрузить сохранение Civilization:", error);
        return false;
      }
    },

    init: function () {
      const schedule = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          saveTimer = null;
          this.save();
        }, 700);
      };

      ["time", "world", "resources", "economy", "workforce", "infrastructure", "city", "camera", "selection", "settings"]
        .forEach(name => C.on(name, schedule));

      window.addEventListener("pagehide", () => this.save());
      window.addEventListener("beforeunload", () => this.save());
    }
  };
})();