(function () {
  "use strict";
  const C = window.Civ;

  C.city = {
    population: 120,
    housing: 120,
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
      let housing = 120;
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

      if (C.research) C.research.daily();
      if (C.infrastructure) C.infrastructure.updateNetwork();
      if (C.workforce) C.workforce.allocate();

      for (const row of C.world.tiles) {
        for (const tile of row) {
          if (!tile.building) continue;
          const definition = C.buildings.catalog[tile.building.type];
          if (!definition) continue;

          const productivity = C.workforce ? C.workforce.productivity(tile) : 0;
          foodProduction += (definition.food || 0) * productivity * (C.research ? C.research.getEffect("food") : 1);
          woodProduction += (definition.wood || 0) * productivity;
          stoneProduction += (definition.stone || 0) * productivity * (C.research ? C.research.getEffect("stone") : 1);
        }
      }

      const consumption = Math.max(1, Math.ceil(this.population / 20));
      const capacity = C.infrastructure ? C.infrastructure.storageCapacity() : 300;
      const roundOne = value => Math.round(value * 10) / 10;

      resources.food = roundOne(Math.max(0, Math.min(capacity, resources.food + foodProduction - consumption)));
      resources.wood = roundOne(Math.max(0, Math.min(capacity, resources.wood + woodProduction)));
      resources.stone = roundOne(Math.max(0, Math.min(capacity, resources.stone + stoneProduction)));

      if (C.state.day % 5 === 0 && this.population < this.housing && resources.food > consumption * 3) {
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