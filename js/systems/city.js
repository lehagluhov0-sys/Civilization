(function () {
  const C = window.Civ;
  C.city = {
    population: 120,
    housing: 120,
    employment: 0,
    maxJobs: 0,
    buildingCount: 0,
    center: null,

    init: function () {
      if (this.center) return;
      let best = null;
      let dist = Infinity;

      for (let y = 0; y < C.world.height; y++) {
        for (let x = 0; x < C.world.width; x++) {
          const tile = C.world.get(x, y);
          const distance = Math.abs(x - C.world.width / 2) + Math.abs(y - C.world.height / 2);
          if (tile && tile.type === "grass" && !tile.building && distance < dist) {
            best = { x: x, y: y };
            dist = distance;
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
      this.employment = Math.min(this.population, jobs);
      this.buildingCount = count;
    },

    daily: function () {
      const resources = C.state.resources;
      let food = 0, wood = 0, stone = 0, upkeep = 0;

      for (const row of C.world.tiles) {
        for (const tile of row) {
          if (!tile.building) continue;
          const definition = C.buildings.catalog[tile.building.type];
          if (!definition) continue;
          food += definition.food || 0;
          wood += definition.wood || 0;
          stone += definition.stone || 0;
          if (tile.building.type !== "city_center") upkeep += 1;
        }
      }

      const consumption = Math.max(1, Math.ceil(this.population / 20));
      resources.food = Math.max(0, resources.food + food - consumption);
      resources.wood += wood;
      resources.stone += stone;
      resources.money = Math.max(0, resources.money - upkeep);

      if (C.state.day % 5 === 0 && this.population < this.housing && resources.food > consumption * 3) {
        this.population++;
        resources.population = this.population;
        C.log("Население поселения выросло до " + this.population + ".");
      }
      if (resources.food === 0 && C.state.day % 5 === 0 && this.population > 10) {
        this.population--;
        resources.population = this.population;
        C.log("Нехватка продовольствия замедлила рост населения.");
      }

      this.recalculate();
      C.emit("resources");
      C.emit("city");
    }
  };
})();