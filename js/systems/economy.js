(function () {
  "use strict";
  const C = window.Civ;

  C.economy = {
    taxRate: 15,
    lastIncome: 0,
    lastExpenses: 0,
    totalIncome: 0,
    totalExpenses: 0,

    setTaxRate: function (value) {
      this.taxRate = Math.max(0, Math.min(30, Number(value) || 0));
      C.emit("economy");
    },

    calculate: function () {
      const income = Math.round(C.city.population * this.taxRate / 1000 * 10) / 10;
      let buildingUpkeep = 0;

      for (const row of C.world.tiles) {
        for (const tile of row) {
          if (tile.building && tile.building.type !== "city_center") buildingUpkeep += 1;
        }
      }

      const roadUpkeep = C.infrastructure ? C.infrastructure.roadUpkeep() : 0;
      const wages = C.workforce ? C.workforce.wageCost() : 0;
      const upkeep = Math.round((buildingUpkeep + roadUpkeep + wages) * 100) / 100;
      return {
        income: income,
        buildingUpkeep: buildingUpkeep,
        roadUpkeep: roadUpkeep,
        wages: wages,
        upkeep: upkeep,
        balance: Math.round((income - upkeep) * 100) / 100
      };
    },

    daily: function () {
      const result = this.calculate();
      this.lastIncome = result.income;
      this.lastExpenses = result.upkeep;
      this.totalIncome += result.income;
      this.totalExpenses += result.upkeep;
      C.state.resources.money = Math.max(
        0,
        Math.round((C.state.resources.money + result.balance) * 100) / 100
      );
      C.emit("economy");
    }
  };
})();