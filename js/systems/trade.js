(function () {
  "use strict";
  const C = window.Civ;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

  C.trade = {
    routes: [],
    dayCounter: 0,

    findPath: function (start, end) {
      const width = C.world.width;
      const height = C.world.height;
      if (!start || !end || !C.world.get(start.x, start.y) || !C.world.get(end.x, end.y)) return null;
      if (C.world.get(start.x, start.y).type === "water" || C.world.get(end.x, end.y).type === "water") return null;
      const total = width * height;
      const previous = new Int32Array(total);
      previous.fill(-2);
      const queue = new Int32Array(total);
      let head = 0;
      let tail = 0;
      const startId = start.y * width + start.x;
      const endId = end.y * width + end.x;
      previous[startId] = -1;
      queue[tail++] = startId;

      while (head < tail && previous[endId] === -2) {
        const id = queue[head++];
        const x = id % width;
        const y = Math.floor(id / width);
        for (const d of dirs) {
          const nx = x + d[0];
          const ny = y + d[1];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nextId = ny * width + nx;
          if (previous[nextId] !== -2) continue;
          const tile = C.world.get(nx, ny);
          if (!tile || tile.type === "water") continue;
          previous[nextId] = id;
          queue[tail++] = nextId;
        }
      }

      if (previous[endId] === -2) return null;
      const path = [];
      let cursor = endId;
      while (cursor !== -1) {
        path.push({ x: cursor % width, y: Math.floor(cursor / width) });
        cursor = previous[cursor];
      }
      path.reverse();
      return path;
    },

    get: function (civId) {
      return this.routes.find(route => route.civId === civId) || null;
    },

    createRoute: function (civId) {
      const civ = C.diplomacy && C.diplomacy.get(civId);
      const country = C.politics && C.politics.get(civId);
      if (!civ || !country) return { ok: false, message: "Не удалось найти эту державу." };
      if (!civ.embassy || !civ.trade) return { ok: false, message: "Сначала открой посольство и заключи торговый договор." };
      if (civ.relation < -35) return { ok: false, message: "Отношения слишком напряжённые для безопасной торговли." };
      if (this.get(civId)) return { ok: false, message: "Торговый маршрут уже существует." };
      const path = this.findPath(C.city.center, country.capital);
      if (!path) return { ok: false, message: "Нельзя проложить сухопутный маршрут: путь пересекает водную преграду." };
      const resources = C.state.resources;
      if (resources.money < 35 || resources.wood < 20) {
        return { ok: false, message: "Для создания маршрута нужно 35 монет и 20 дерева." };
      }
      resources.money -= 35;
      resources.wood -= 20;
      const route = {
        id: "route-" + civId,
        civId: civId,
        points: path,
        length: Math.max(0, path.length - 1),
        active: true,
        createdDay: C.state.day,
        days: 0
      };
      this.routes.push(route);
      C.emit("resources");
      C.emit("trade");
      C.emit("world");
      C.log("Открыт торговый маршрут с державой «" + civ.name + "». Длина пути: " + route.length + " клеток.");
      return { ok: true, route: route };
    },

    closeRoute: function (civId) {
      const route = this.get(civId);
      if (!route) return { ok: false, message: "Торговый маршрут не найден." };
      this.routes = this.routes.filter(item => item.civId !== civId);
      C.emit("trade");
      C.emit("world");
      C.log("Торговый маршрут закрыт.");
      return { ok: true };
    },

    daily: function () {
      this.dayCounter++;
      this.routes.forEach(route => {
        const civ = C.diplomacy && C.diplomacy.get(route.civId);
        route.active = !!(civ && civ.trade && civ.relation >= -35);
        if (!route.active) return;
        route.days++;
        C.state.resources.money = Math.round((C.state.resources.money + 1.2) * 100) / 100;
        if (route.days % 15 === 0 && civ) {
          civ.trust = Math.min(100, civ.trust + 1);
          civ.relation = Math.min(100, civ.relation + 1);
        }
      });
      if (this.dayCounter % 5 === 0) C.emit("trade");
    },

    exportData: function () {
      return {
        dayCounter: this.dayCounter,
        routes: this.routes.map(route => ({
          id: route.id, civId: route.civId,
          points: route.points.map(point => ({ x: point.x, y: point.y })),
          length: route.length, active: route.active,
          createdDay: route.createdDay, days: route.days
        }))
      };
    },

    importData: function (data) {
      if (!data || typeof data !== "object") return;
      this.dayCounter = Math.max(0, Number(data.dayCounter) || 0);
      this.routes = (Array.isArray(data.routes) ? data.routes : []).slice(0, 8).map(route => {
        const civ = C.diplomacy && C.diplomacy.get(route.civId);
        if (!civ || !Array.isArray(route.points) || route.points.length < 2 || route.points.length > C.world.width * C.world.height) return null;
        const points = route.points.filter(point =>
          point && Number.isInteger(point.x) && Number.isInteger(point.y) &&
          point.x >= 0 && point.y >= 0 && point.x < C.world.width && point.y < C.world.height &&
          C.world.get(point.x, point.y).type !== "water"
        ).map(point => ({ x: point.x, y: point.y }));
        if (points.length < 2) return null;
        return {
          id: "route-" + civ.id, civId: civ.id, points,
          length: points.length - 1, active: !!route.active,
          createdDay: Math.max(1, Number(route.createdDay) || 1),
          days: Math.max(0, Number(route.days) || 0)
        };
      }).filter(Boolean);
    }
  };
})();