(function () {
  "use strict";
  const C = window.Civ;
  const STORAGE_KEY = "civilization_save_v1";
  const SLOT_PREFIX = "civilization_slot_v1_";
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

    listSlots: function () {
      return [1, 2, 3].map(id => {
        try {
          const raw = localStorage.getItem(SLOT_PREFIX + id);
          if (!raw) return { id: id, empty: true };
          const data = JSON.parse(raw);
          return { id: id, empty: false, savedAt: Number(data.savedAt) || 0,
            day: Number(data.state && data.state.day) || 1,
            year: Number(data.state && data.state.year) || 1,
            population: Number(data.city && data.city.population) || 5 };
        } catch (error) { return { id: id, empty: true }; }
      });
    },

    deleteSlot: function (id) {
      if (![1, 2, 3].includes(Number(id))) return false;
      localStorage.removeItem(SLOT_PREFIX + Number(id));
      return true;
    },

    save: function (slotId) {
      // A new-game reload must not write the old world back during pagehide/beforeunload.
      try {
        if (!slotId && sessionStorage.getItem("civilization_start_new_game") === "1") return true;
        const buildings = [];
        const roads = [];
        for (const row of C.world.tiles) {
          for (const tile of row) {
            if (tile.building) buildings.push({
              x: tile.x,
              y: tile.y,
              type: tile.building.type,
              level: tile.building.level || 1
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
            showPoliticalMap: !!C.state.showPoliticalMap,
            showCountryBorders: C.state.showCountryBorders !== false,
            politicalMapInitialized: true,
            showTradeRoutes: !!C.state.showTradeRoutes,
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
          research: C.research ? C.research.exportData() : null,
          diplomacy: C.diplomacy ? C.diplomacy.exportData() : null,
          politics: C.politics ? C.politics.exportData() : null,
          trade: C.trade ? C.trade.exportData() : null,
          worldEvents: C.worldEvents ? C.worldEvents.exportData() : null,
          citizens: C.citizens ? C.citizens.exportData() : null,
          map: C.world && C.world.exportData ? C.world.exportData() : null,
          buildings: buildings,
          roads: roads
        };

        localStorage.setItem(slotId ? SLOT_PREFIX + slotId : STORAGE_KEY, JSON.stringify(data));
        this.lastSavedAt = data.savedAt;
        return true;
      } catch (error) {
        console.warn("Не удалось сохранить Civilization:", error);
        return false;
      }
    },

    load: function (slotId) {
      try {
        const raw = localStorage.getItem(slotId ? SLOT_PREFIX + slotId : STORAGE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (!data || data.version !== SAVE_VERSION || !data.state ||
            !Array.isArray(data.buildings) || !Array.isArray(data.roads)) {
          console.warn("Сохранение Civilization имеет неподдерживаемый формат.");
          return false;
        }

        const savedState = data.state;
        if (savedState.resources && typeof savedState.resources === "object") {
          ["population", "money", "food", "wood", "stone", "iron", "copper"].forEach(key => {
            const value = Number(savedState.resources[key]);
            if (Number.isFinite(value) && value >= 0) C.state.resources[key] = value;
          });
        }

        C.state.day = Math.max(1, Math.min(30, Number(savedState.day) || 1));
        C.state.seasonIndex = Math.max(0, Math.min(3, Number(savedState.seasonIndex) || 0));
        C.state.year = Math.max(1, Number(savedState.year) || 1);
        C.state.paused = savedState.paused !== false;
        C.state.speed = [1, 2, 4].includes(Number(savedState.speed)) ? Number(savedState.speed) : 1;
        C.state.showGrid = false;
        C.state.showPoliticalMap = savedState.politicalMapInitialized ? !!savedState.showPoliticalMap : true;
        C.state.showCountryBorders = savedState.showCountryBorders !== false;
        C.state.politicalMapInitialized = true;
        C.state.showTradeRoutes = !!savedState.showTradeRoutes;

        if (savedState.camera && Number.isFinite(savedState.camera.x) &&
            Number.isFinite(savedState.camera.y) && Number.isFinite(savedState.camera.zoom)) {
          C.state.camera.x = savedState.camera.x;
          C.state.camera.y = savedState.camera.y;
          C.state.camera.zoom = Math.max(0.45, Math.min(2.5, savedState.camera.zoom));
        }

        C.state.selected = validPoint(savedState.selected) ? savedState.selected : null;
        const mapRestored = !!(data.map && C.world.importData && C.world.importData(data.map));
        if (!mapRestored && C.world.prepareForLegacySave) C.world.prepareForLegacySave(data);
        for (const row of C.world.tiles) {
          for (const tile of row) {
            tile.building = null;
            tile.road = false;
            tile.owner = null;
          }
        }
        C.city.population = Math.max(5, Number(data.city && data.city.population) || 5);
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
            tile.building = { type: item.type, workers: 0, level: Math.max(1, Number(item.level) || 1) };
            tile.road = false;
            if (item.type === "city_center") C.city.center = { x: item.x, y: item.y };
          }
        });

        if (C.research && data.research) C.research.importData(data.research);
        if (C.diplomacy && data.diplomacy) C.diplomacy.importData(data.diplomacy);
        if (C.politics && data.politics) C.politics.importData(data.politics);
        if (C.trade && data.trade) C.trade.importData(data.trade);
        if (C.worldEvents && data.worldEvents) C.worldEvents.importData(data.worldEvents);
        if (C.citizens && data.citizens) C.citizens.importData(data.citizens);

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

      ["time", "world", "resources", "economy", "workforce", "infrastructure", "city", "camera", "selection", "settings", "research", "diplomacy", "politics", "trade", "worldEvents", "citizens"]
        .forEach(name => C.on(name, schedule));

      window.addEventListener("pagehide", () => this.save());
      window.addEventListener("beforeunload", () => this.save());
      this.save();
    }
  };
})();