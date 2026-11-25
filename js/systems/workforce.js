(function () {
  "use strict";
  const C = window.Civ;
  const priority = { farm: 1, fishery: 1, lumber: 2, quarry: 3, market: 4, warehouse: 5 };

  C.workforce = {
    participationRate: 0.55,
    wagePerWorker: 0.08,
    employed: 0,
    laborForce: 0,
    unemployed: 0,
    vacantJobs: 0,
    workersByType: {},

    allocate: function () {
      const laborForce = Math.floor(C.city.population * this.participationRate);
      let remaining = laborForce;
      let totalJobs = 0;
      const workplaces = [];
      const byType = {};

      for (const row of C.world.tiles) {
        for (const tile of row) {
          if (!tile.building) continue;
          const definition = C.buildings.catalog[tile.building.type];
          if (!definition || !definition.jobs) {
            tile.building.workers = 0;
            continue;
          }
          totalJobs += definition.jobs;
          workplaces.push({ tile: tile, type: tile.building.type, jobs: definition.jobs });
        }
      }

      workplaces.sort((a, b) =>
        (priority[a.type] || 10) - (priority[b.type] || 10) ||
        a.tile.y - b.tile.y ||
        a.tile.x - b.tile.x
      );

      for (const workplace of workplaces) {
        const workers = Math.min(workplace.jobs, remaining);
        workplace.tile.building.workers = workers;
        remaining -= workers;
        byType[workplace.type] = (byType[workplace.type] || 0) + workers;
      }

      this.laborForce = laborForce;
      this.employed = laborForce - remaining;
      this.unemployed = remaining;
      this.vacantJobs = Math.max(0, totalJobs - this.employed);
      this.workersByType = byType;

      C.city.laborForce = this.laborForce;
      C.city.employment = this.employed;
      C.city.unemployed = this.unemployed;
      C.city.vacantJobs = this.vacantJobs;
    },

    productivity: function (tile) {
      if (!tile || !tile.building) return 0;
      const definition = C.buildings.catalog[tile.building.type];
      if (!definition || !definition.jobs) return 0;
      const workers = tile.building.workers || 0;
      if (!workers) return 0;
      return (workers / definition.jobs) * C.infrastructure.efficiency(tile.x, tile.y);
    },

    wageCost: function () {
      return Math.round(this.employed * this.wagePerWorker * 100) / 100;
    }
  };
})();