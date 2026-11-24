(function () {
  "use strict";
  const C = window.Civ;
  const palette = ["#d9a441", "#67a8d8", "#8fc16b", "#bd82cf", "#d17d68", "#63c2b2", "#d18d48", "#8f9bd1"];
  const starts = [[5, 5], [42, 6], [6, 41], [42, 41], [24, 5], [24, 42], [5, 24], [42, 24]];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  C.politics = {
    countries: [],
    dayCounter: 0,
    initialized: false,

    findCapital: function (start, used, player) {
      let best = null;
      let bestScore = Infinity;
      for (let radius = 0; radius <= 12; radius++) {
        for (let y = Math.max(1, start[1] - radius); y <= Math.min(C.world.height - 2, start[1] + radius); y++) {
          for (let x = Math.max(1, start[0] - radius); x <= Math.min(C.world.width - 2, start[0] + radius); x++) {
            const tile = C.world.get(x, y);
            if (!tile || tile.type === "water") continue;
            if (Math.abs(x - player.x) + Math.abs(y - player.y) < 9) continue;
            if (used.some(p => Math.abs(x - p.x) + Math.abs(y - p.y) < 9)) continue;
            const score = Math.abs(x - start[0]) + Math.abs(y - start[1]);
            if (score < bestScore) { best = { x: x, y: y }; bestScore = score; }
          }
        }
        if (best) return best;
      }
      return null;
    },

    init: function () {
      if (this.initialized && this.countries.length) {
        this.recalculateTerritories();
        return;
      }
      const player = C.city.center || { x: 24, y: 24 };
      const diplomacy = C.diplomacy ? C.diplomacy.civilizations : [];
      const used = [];
      this.countries = diplomacy.map((civ, i) => {
        const capital = this.findCapital(starts[i % starts.length], used, player);
        if (!capital) return null;
        used.push(capital);
        return {
          id: civ.id, name: civ.name, flag: civ.flag, leader: civ.leader,
          color: palette[i % palette.length], capital: capital,
          population: 650 + i * 275, treasury: 100 + i * 35,
          development: 1 + (i % 2), power: 1, cities: 1,
          food: 90 + i * 12, stability: 70 + i * 3,
          cityNames: [civ.name + " — столица"], lastGrowth: 0, territory: 0
        };
      }).filter(Boolean);
      this.dayCounter = 0;
      this.initialized = true;
      this.recalculateTerritories();
      C.emit("politics");
      C.log("На политической карте появились независимые государства: " + this.countries.length + ".");
    },

    recalculateTerritories: function () {
      if (!C.city.center) return;
      const centers = [{ id: "player", x: C.city.center.x, y: C.city.center.y, power: 1 }]
        .concat(this.countries.map(c => ({ id: c.id, x: c.capital.x, y: c.capital.y, power: c.power || 1 })));
      const counts = { player: 0 };
      this.countries.forEach(c => { counts[c.id] = 0; });
      for (let y = 0; y < C.world.height; y++) {
        for (let x = 0; x < C.world.width; x++) {
          let winner = centers[0];
          let best = Infinity;
          for (const center of centers) {
            const distance = Math.abs(x - center.x) + Math.abs(y - center.y);
            const score = distance - Math.min(4, center.power) * 0.65;
            if (score < best) { best = score; winner = center; }
          }
          const tile = C.world.get(x, y);
          tile.owner = winner.id;
          counts[winner.id] = (counts[winner.id] || 0) + 1;
        }
      }
      this.countries.forEach(c => { c.territory = counts[c.id] || 0; });
      this.playerTerritory = counts.player || 0;
      C.emit("politics");
      C.emit("world");
    },

    daily: function () {
      this.dayCounter++;
      if (this.dayCounter % 10 === 0) {
        this.countries.forEach((c, i) => {
          const growth = 2 + ((this.dayCounter + i * 3) % 4);
          c.population += growth;
          c.treasury += 1 + (i % 3);
          c.food = Math.max(0, Math.min(500, c.food + 2 - (c.population / 900)));
          c.stability = clamp(c.stability + (c.food > 20 ? 1 : -2), 20, 100);
          if (this.dayCounter % 30 === 0 && c.development < 10) {
            c.development++;
            c.cities++;
            if (!Array.isArray(c.cityNames)) c.cityNames = [c.name + " — столица"];
            c.cityNames.push(c.name + " — город " + c.cities);
            c.treasury = Math.max(0, c.treasury - 20);
            C.log("Держава «" + c.name + "» развила экономику и основала новый город.");
          }
          c.power = 1 + c.development * 0.35 + c.cities * 0.1;
        });
      }
      if (this.dayCounter % 30 === 0) this.recalculateTerritories();
      if (this.dayCounter % 10 === 0) C.emit("politics");
    },

    get: function (id) {
      return this.countries.find(c => c.id === id) || null;
    },

    exportData: function () {
      return {
        dayCounter: this.dayCounter,
        initialized: this.initialized,
        playerTerritory: this.playerTerritory || 0,
        countries: this.countries.map(c => ({
          id: c.id, capital: { x: c.capital.x, y: c.capital.y },
          population: c.population, treasury: c.treasury,
          development: c.development, power: c.power, cities: c.cities,
          food: c.food, stability: c.stability, cityNames: Array.isArray(c.cityNames) ? c.cityNames.slice(0, 20) : [c.name + " — столица"]
        }))
      };
    },

    importData: function (data) {
      if (!data || typeof data !== "object" || !Array.isArray(data.countries)) return;
      const diplomacy = C.diplomacy ? C.diplomacy.civilizations : [];
      this.countries = data.countries.slice(0, 8).map((saved, i) => {
        const civ = diplomacy.find(c => c.id === saved.id);
        const x = Number(saved.capital && saved.capital.x);
        const y = Number(saved.capital && saved.capital.y);
        if (!civ || !Number.isInteger(x) || !Number.isInteger(y) ||
            x < 0 || y < 0 || x >= C.world.width || y >= C.world.height) return null;
        return {
          id: civ.id, name: civ.name, flag: civ.flag, leader: civ.leader,
          color: palette[i % palette.length], capital: { x: x, y: y },
          population: Math.max(1, Number(saved.population) || 500),
          treasury: Math.max(0, Number(saved.treasury) || 0),
          development: clamp(Number(saved.development) || 1, 1, 10),
          power: clamp(Number(saved.power) || 1, 1, 10),
          cities: clamp(Number(saved.cities) || 1, 1, 20),
          food: clamp(Number(saved.food) || 0, 0, 500),
          stability: clamp(Number(saved.stability) || 50, 0, 100),
          cityNames: Array.isArray(saved.cityNames) ? saved.cityNames.slice(0, 20) : [civ.name + " — столица"],
          territory: 0
        };
      }).filter(Boolean);
      this.dayCounter = Math.max(0, Number(data.dayCounter) || 0);
      this.initialized = !!data.initialized && this.countries.length > 0;
      this.playerTerritory = Math.max(0, Number(data.playerTerritory) || 0);
    }
  };
})();