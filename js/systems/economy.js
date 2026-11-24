(function () {
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
      let upkeep = 0;
      for (const row of C.world.tiles) {
        for (const tile of row) {
          if (tile.building && tile.building.type !== "city_center") upkeep += 1;
        }
      }
      return { income: income, upkeep: upkeep, balance: Math.round((income - upkeep) * 10) / 10 };
    },

    daily: function () {
      const result = this.calculate();
      this.lastIncome = result.income;
      this.lastExpenses = result.upkeep;
      this.totalIncome += result.income;
      this.totalExpenses += result.upkeep;
      C.state.resources.money = Math.max(0, Math.round((C.state.resources.money + result.balance) * 10) / 10);
      C.emit("economy");
    }
  };
})();
