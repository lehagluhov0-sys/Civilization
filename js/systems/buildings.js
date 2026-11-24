(function () {
  const C = window.Civ;
  const catalog = {
    city_center: {name:"Центр поселения", icon:"⌂", cost:{}, housing:0, jobs:0, terrain:["grass"], description:"Главное здание поселения. Здесь сосредоточено управление городом."},
    house: {name:"Жилой дом", icon:"⌂", cost:{wood:20,stone:5,money:25}, housing:12, jobs:0, terrain:["grass"], description:"Увеличивает вместимость поселения на 12 жителей."},
    farm: {name:"Ферма", icon:"♧", cost:{wood:15,stone:5,money:20}, food:12, jobs:8, terrain:["grass"], description:"Производит до 12 единиц еды каждый игровой день."},
    lumber: {name:"Лесопилка", icon:"♜", cost:{wood:20,stone:10,money:30}, wood:7, jobs:8, terrain:["forest"], description:"Заготавливает до 7 единиц древесины в день."},
    quarry: {name:"Каменоломня", icon:"◆", cost:{wood:10,stone:20,money:30}, stone:6, jobs:8, terrain:["rock"], description:"Добывает до 6 единиц камня в день."}
  };
  C.buildings = {
    catalog: catalog,
    place: function (x, y, type, free) {
      const tile = C.world.get(x, y);
      const def = catalog[type];
      if (!tile || !def) return {ok:false, message:"Невозможно построить здесь."};
      if (tile.building) return {ok:false, message:"На этой клетке уже есть здание."};
      if (!def.terrain.includes(tile.type)) return {ok:false, message:"Это здание нельзя строить на данной местности."};
      const resources = C.state.resources;
      if (!free) {
        for (const key in def.cost) {
          if (resources[key] < def.cost[key]) return {ok:false, message:"Недостаточно ресурсов для строительства."};
        }
        for (const key in def.cost) resources[key] -= def.cost[key];
      }
      tile.building = {type:type};
      C.city.recalculate();
      C.emit("resources");
      C.emit("world");
      C.log("Построено: " + def.name + ".");
      return {ok:true, message:"Построено: " + def.name};
    }
  };
})();