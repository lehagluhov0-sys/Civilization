(function () {
  "use strict";
  const C = window.Civ;

  C.city = {
    population: 5,
    housing: 5,
    employment: 0,
    maxJobs: 0,
    laborForce: 0,
    unemployed: 0,
    vacantJobs: 0,
    buildingCount: 0,
    center: null,

    init: function () {
      if (this.center) return;
      let best = null;
      let bestDistance = Infinity;

      for (let y = 0; y < C.world.height; y++) {
        for (let x = 0; x < C.world.width; x++) {
          const tile = C.world.get(x, y);
          const distance = Math.abs(x - C.world.width / 2) + Math.abs(y - C.world.height / 2);
          if (tile && tile.type === "grass" && !tile.building && distance < bestDistance) {
            best = { x: x, y: y };
            bestDistance = distance;
          }
        }
      }

      if (!best) throw new Error("На карте не найдено место для основания поселения.");
      this.center = best;
      const result = C.buildings.place(best.x, best.y, "city_center", true);
      if (!result.ok) throw new Error(result.message);
      this.recalculate();
      C.log("Поселение основано на координатах " + (best.x + 1) + ", " + (best.y + 1) + ".");
    },

    recalculate: function () {
      let housing = 5;
      let jobs = 0;
      let count = 0;

      for (const row of C.world.tiles) {
        for (const tile of row) {
          if (!tile.building) continue;
          count++;
          const definition = C.buildings.catalog[tile.building.type];
          if (!definition) continue;
          housing += definition.housing || 0;
          jobs += definition.jobs || 0;
        }
      }

      this.housing = housing;
      this.maxJobs = jobs;
      this.buildingCount = count;
      if (C.workforce) C.workforce.allocate();
    },

    daily: function () {
      const resources = C.state.resources;
      let foodProduction = 0;
      let woodProduction = 0;
      let stoneProduction = 0;
      let ironProduction = 0;
      let copperProduction = 0;

      if (C.research) C.research.daily();
      if (C.diplomacy) C.diplomacy.daily();
      if (C.politics) C.politics.daily();
      if (C.trade) C.trade.daily();
      if (C.worldEvents) C.worldEvents.daily();
      if (C.citizens) C.citizens.daily();
      if (C.infrastructure) C.infrastructure.updateNetwork();
      if (C.workforce) C.workforce.allocate();

      for (const row of C.world.tiles) {
        for (const tile of row) {
          if (!tile.building) continue;
          const definition = C.buildings.catalog[tile.building.type];
          if (!definition) continue;

          const productivity = C.workforce ? C.workforce.productivity(tile) : 0;
          foodProduction += (definition.food || 0) * productivity *
            (C.research ? C.research.getEffect("farm") * C.research.getEffect("irrigation") * C.research.getEffect("rotation") : 1) *
            (C.terrain ? C.terrain.productionMultiplier(tile, "food") : 1);
          woodProduction += (definition.wood || 0) * productivity * (C.research ? C.research.getEffect("lumber") : 1) *
            (C.terrain ? C.terrain.productionMultiplier(tile, "wood") : 1);
          stoneProduction += (definition.stone || 0) * productivity *
            (C.research ? C.research.getEffect("stone") : 1) *
            (C.terrain ? C.terrain.productionMultiplier(tile, "stone") : 1);
          ironProduction += (definition.iron || 0) * productivity;
          copperProduction += (definition.copper || 0) * productivity;
        }
      }

      // A small founding camp gathers only what the nearby landscape can provide.
      // This replaces the old oversized starter stockpile and slows early expansion.
      const center = this.center || { x: 64, y: 64 };
      let nearbyForest = false, nearbyRock = false;
      for (let y = Math.max(0, center.y - 5); y <= Math.min(C.world.height - 1, center.y + 5); y++) {
        for (let x = Math.max(0, center.x - 5); x <= Math.min(C.world.width - 1, center.x + 5); x++) {
          const tile = C.world.get(x, y);
          if (tile && tile.type === "forest") nearbyForest = true;
          if (tile && (tile.type === "rock" || tile.type === "mountain")) nearbyRock = true;
        }
      }
      resources.food += 0.8;
      if (nearbyForest) resources.wood += 0.65;
      if (nearbyRock) resources.stone += 0.3;
      resources.money += 0.12;
      const consumption = Math.max(0.4, Math.ceil(this.population / 35));
      const capacity = C.infrastructure ? C.infrastructure.storageCapacity() : 300;
      const roundOne = value => Math.round(value * 10) / 10;

      resources.food = roundOne(Math.max(0, Math.min(capacity, resources.food + foodProduction - consumption)));
      resources.wood = roundOne(Math.max(0, Math.min(capacity, resources.wood + woodProduction)));
      resources.stone = roundOne(Math.max(0, Math.min(capacity, resources.stone + stoneProduction)));
      resources.iron = roundOne(Math.max(0, Math.min(capacity, (resources.iron || 0) + ironProduction)));
      resources.copper = roundOne(Math.max(0, Math.min(capacity, (resources.copper || 0) + copperProduction)));

      const prototypePopulationCap = 15;
      if (C.state.day % 5 === 0 && this.population < Math.min(this.housing, prototypePopulationCap) &&
          resources.food > consumption * 3) {
        this.population++;
        resources.population = this.population;
        C.log("Население поселения выросло до " + this.population + ".");
      }

      if (resources.food === 0 && C.state.day % 5 === 0 && this.population > 10) {
        this.population--;
        resources.population = this.population;
        C.log("Нехватка продовольствия привела к сокращению населения.");
      }

      this.recalculate();
      if (C.economy) C.economy.daily();
      C.emit("resources");
      C.emit("workforce");
      C.emit("city");
    }
  };
})();