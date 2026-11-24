(function () {
  "use strict";
  const C = window.Civ;
  const catalog = {
    city_center: {
      name: "Центр поселения", icon: "⌂", cost: {}, housing: 0, jobs: 0,
      terrain: ["grass"],
      description: "Главное здание поселения. Здесь сосредоточено управление городом."
    },
    house: {
      name: "Жилой дом", icon: "⌂", cost: { wood: 20, stone: 5, money: 25 },
      housing: 12, jobs: 0, terrain: ["grass"],
      description: "Увеличивает вместимость поселения на 12 жителей."
    },
    farm: {
      name: "Ферма", icon: "♧", cost: { wood: 15, stone: 5, money: 20 },
      food: 12, jobs: 8, terrain: ["grass"],
      description: "Производит до 12 единиц еды в день. Выпуск зависит от работников и дорожной связи."
    },
    lumber: {
      name: "Лесопилка", icon: "♜", cost: { wood: 20, stone: 10, money: 30 },
      wood: 7, jobs: 8, terrain: ["forest"],
      description: "Заготавливает до 7 единиц древесины в день. Выпуск зависит от работников и дорожной связи."
    },
    quarry: {
      name: "Каменоломня", icon: "◆", cost: { wood: 10, stone: 20, money: 30 },
      stone: 6, jobs: 8, terrain: ["rock", "mountain"],
      description: "Добывает до 6 единиц камня в день. Выпуск зависит от работников и дорожной связи."
    },
    warehouse: {
      name: "Склад", icon: "▣", cost: { wood: 35, stone: 20, money: 50 },
      storage: 250, jobs: 2, terrain: ["grass"],
      description: "Увеличивает вместимость хранилища ресурсов на 250 единиц."
    }
  };

  C.buildings = {
    catalog: catalog,

    place: function (x, y, type, free) {
      const tile = C.world.get(x, y);
      const definition = catalog[type];
      if (!tile || !definition) return { ok: false, message: "Невозможно построить здесь." };
      if (tile.building) return { ok: false, message: "На этой клетке уже есть здание." };
      if (tile.road) return { ok: false, message: "Сначала выбери клетку без дороги." };
      if (!definition.terrain.includes(tile.type)) {
        return { ok: false, message: "Это здание нельзя строить на данной местности." };
      }

      const resources = C.state.resources;
      if (!free) {
        for (const key in definition.cost) {
          if ((resources[key] || 0) < definition.cost[key]) {
            return { ok: false, message: "Недостаточно ресурсов для строительства." };
          }
        }
        for (const key in definition.cost) resources[key] -= definition.cost[key];
      }

      tile.building = { type: type, workers: 0 };
      if (C.infrastructure) C.infrastructure.updateNetwork();
      C.city.recalculate();
      C.emit("resources");
      C.emit("workforce");
      C.emit("infrastructure");
      C.emit("world");
      C.log("Построено: " + definition.name + ".");
      return { ok: true, message: "Построено: " + definition.name };
    }
  };
})();