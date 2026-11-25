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
      name: "Жилой дом", icon: "⌂", cost: { wood: 24, stone: 8 },
      housing: 12, jobs: 0, terrain: ["grass"],
      description: "Увеличивает вместимость поселения на 12 жителей."
    },
    farm: {
      name: "Ферма", icon: "♧", cost: { wood: 12, stone: 4 },
      food: 12, jobs: 8, terrain: ["grass"],
      description: "Производит до 12 единиц еды в день. Выпуск зависит от работников и дорожной связи."
    },
    lumber: {
      name: "Лесопилка", icon: "♜", cost: { wood: 18, stone: 5 },
      wood: 7, jobs: 8, terrain: ["forest"],
      description: "Заготавливает до 7 единиц древесины в день. Выпуск зависит от работников и дорожной связи."
    },
    quarry: {
      name: "Каменная шахта", icon: "◆", cost: { wood: 10, stone: 8 },
      stone: 7, jobs: 6, terrain: ["rock", "mountain"], requiresDeposit: "stone",
      description: "Добывает строительный камень из каменного месторождения."
    },
    iron_mine: {
      name: "Железная шахта", icon: "⛏", cost: { wood: 22, stone: 18 },
      iron: 4, jobs: 7, terrain: ["rock", "mountain"], requiresDeposit: "iron", requiresResearch: "mining",
      description: "Добывает железную руду из железного месторождения."
    },
    copper_mine: {
      name: "Медная шахта", icon: "⛏", cost: { wood: 20, stone: 15 },
      copper: 4, jobs: 6, terrain: ["rock", "mountain"], requiresDeposit: "copper", requiresResearch: "mining",
      description: "Добывает медную руду из медного месторождения."
    },
    warehouse: {
      name: "Склад", icon: "▣", cost: { wood: 35, stone: 20 },
      storage: 250, jobs: 2, terrain: ["grass"],
      description: "Увеличивает вместимость хранилища ресурсов на 250 единиц."
    },
    fishery: {
      name: "Рыбацкая пристань", icon: "⚓", cost: { wood: 20, stone: 6 },
      food: 10, jobs: 6, terrain: ["grass"], requiresWater: true,
      description: "Ловит рыбу и снабжает поселение едой. Требует соседства с рекой или озером."
    },
    market: {
      name: "Рынок", icon: "▤", cost: { wood: 30, stone: 12 },
      income: 1.8, jobs: 5, terrain: ["grass"],
      description: "Приносит торговый доход каждый день. Доход зависит от числа работников."
    }
  };

  C.buildings = {
    catalog: catalog,

    place: function (x, y, type, free) {
      const tile = C.world.get(x, y);
      const definition = catalog[type];
      if (!tile || !definition) return { ok: false, message: "Невозможно построить здесь." };
      if (definition.requiresResearch && (!C.research || !C.research.isCompleted(definition.requiresResearch))) return { ok: false, message: "Сначала изучи технологию: " + definition.requiresResearch + "." };
      if (definition.requiresDeposit && tile.deposit !== definition.requiresDeposit) return { ok: false, message: "Здесь нет подходящего месторождения." };
      if (tile.building || tile.construction) return { ok: false, message: "На этом участке уже идёт строительство или стоит здание." };
      if (tile.road) return { ok: false, message: "Сначала выбери клетку без дороги." };
      if (C.terrain && !C.terrain.canBuild(definition, x, y)) {
        return { ok: false, message: definition.requiresWater
          ? "Для пристани нужна клетка рядом с рекой или озером."
          : "Это здание нельзя построить на такой местности." };
      }
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