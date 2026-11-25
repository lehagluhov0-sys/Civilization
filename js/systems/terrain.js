(function () {
  "use strict";
  const C = window.Civ;
  const biomes = {
    water: { name: "Вода", fertility: 0, food: 0, wood: 0, stone: 0, road: 0, note: "Реки и озёра формируют естественные границы. На берегу можно строить рыбацкие пристани." },
    grass: { name: "Равнина", fertility: 1, food: 1, wood: 0.1, stone: 0.1, road: 1, note: "Наиболее удобная местность для поселений, ферм и рынков." },
    forest: { name: "Лес", fertility: 0.72, food: 0.55, wood: 1.3, stone: 0.15, road: 0.85, note: "Леса дают древесину и немного продовольствия. Подходят для лесопилок." },
    rock: { name: "Скалы", fertility: 0.42, food: 0.25, wood: 0, stone: 1.25, road: 0.75, note: "Каменистые холмы богаты строительным камнем." },
    mountain: { name: "Горы", fertility: 0.2, food: 0.1, wood: 0, stone: 1.55, road: 0.45, note: "Горные массивы дают много камня, но дороги здесь строить дороже." },
    desert: { name: "Пустыня", fertility: 0.28, food: 0.35, wood: 0.05, stone: 0.2, road: 0.8, note: "Засушливые земли малопригодны для земледелия." },
    tundra: { name: "Тундра", fertility: 0.35, food: 0.45, wood: 0.35, stone: 0.3, road: 0.7, note: "Холодный климат ограничивает сельское хозяйство." },
    swamp: { name: "Болото", fertility: 0.65, food: 0.65, wood: 0.3, stone: 0.1, road: 0.5, note: "Влажные низины дают небольшую прибавку к плодородию, но осложняют строительство." }
  };
  const seasons = { "Весна": 1.1, "Лето": 1.25, "Осень": 1, "Зима": 0.65 };
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

  C.terrain = {
    biomes: biomes,
    getInfo: function (type) { return biomes[type] || biomes.grass; },
    hasAdjacentWater: function (x, y) {
      return dirs.some(d => {
        const tile = C.world.get(x + d[0], y + d[1]);
        return tile && tile.type === "water";
      });
    },
    canBuild: function (definition, x, y) {
      const tile = C.world.get(x, y);
      if (!tile || !definition || !definition.terrain.includes(tile.type)) return false;
      if (definition.requiresWater && !this.hasAdjacentWater(x, y)) return false;
      if (definition.requiresWater && tile.type === "water") return false;
      return true;
    },
    productionMultiplier: function (tile, output) {
      if (!tile) return 0;
      const info = this.getInfo(tile.type);
      let value = output === "food" ? info.food :
        output === "wood" ? info.wood :
        output === "stone" ? info.stone : 1;
      if (output === "food") {
        value *= seasons[C.time ? C.time.season() : "Весна"] || 1;
        if (tile.building && tile.building.type === "fishery" && this.hasAdjacentWater(tile.x, tile.y)) value *= 1.2;
      }
      if (C.worldEvents && C.worldEvents.getModifier) {
        value *= C.worldEvents.getModifier(output);
      }
      return Math.max(0, value);
    },
    roadCost: function (tile) {
      if (!tile) return { wood: 3, money: 2 };
      if (tile.type === "mountain") return { wood: 6, money: 5 };
      if (tile.type === "swamp") return { wood: 5, money: 4 };
      return { wood: 3, money: 2 };
    },
    roadUpkeepMultiplier: function (tile) {
      if (!tile) return 1;
      return tile.type === "mountain" ? 1.8 : tile.type === "swamp" ? 1.5 : 1;
    },
    fertility: function (tile) {
      return tile ? Math.round(this.getInfo(tile.type).fertility * 100) : 0;
    }
  };
})();