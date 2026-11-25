(function () {
  "use strict";
  const C = window.Civ;
  const directions = [[1,0],[-1,0],[0,1],[0,-1]];

  const system = {
    agents: [],
    sites: [],
    orders: [],
    nextId: 1,
    animationTime: 0,
    redrawTimer: 0,
    thinkTimer: 0,
    simTimer: 0,
    decisionInterval: 1.6,
    buildingsCache: [],
    buildingsCacheTimer: 0,
    initialized: false,

    init: function () {
      if (this.initialized) return;
      this.initialized = true;
      if (this.agents.length) return;
      const center = C.city.center || { x: 24, y: 24 };
      for (let i = 0; i < 5; i++) {
        const angle = i * 2.399963;
        const radius = 0.7 + (i % 4) * 0.38;
        const x = Math.max(1, Math.min(C.world.width - 2, center.x + Math.cos(angle) * radius));
        const y = Math.max(1, Math.min(C.world.height - 2, center.y + Math.sin(angle) * radius));
        this.agents.push({
          id: this.nextId++,
          role: i < 2 ? "builder" : "resident",
          x: x, y: y,
          targetX: x, targetY: y,
          direction: 1,
          walk: Math.random() * 6.28,
          color: ["#d9a36d", "#c77d57", "#e1c28b", "#9a654d"][i % 4],
          shirt: ["#547b91", "#8b604d", "#6d8051", "#a18b55", "#76618f"][i % 5],
          activity: i < 4 ? "building" : "wandering",
          hunger: 0,
          decisionTimer: Math.random() * 1.5
        });
      }
      this.chooseWanderTargets();
    },

    chooseWanderTargets: function () {
      const center = C.city.center || { x: 24, y: 24 };
      this.agents.forEach(agent => {
        if (agent.role === "builder" && this.sites.length) return;
        const angle = Math.random() * Math.PI * 2;
        const distance = 1.2 + Math.random() * 4.2;
        let x = Math.round(center.x + Math.cos(angle) * distance);
        let y = Math.round(center.y + Math.sin(angle) * distance);
        x = Math.max(1, Math.min(C.world.width - 2, x));
        y = Math.max(1, Math.min(C.world.height - 2, y));
        const tile = C.world.get(x, y);
        if (tile && tile.type !== "water" && !tile.building) {
          agent.targetX = x + 0.5;
          agent.targetY = y + 0.5;
        }
      });
    },

    activeSite: function () {
      return this.sites.length ? this.sites[0] : null;
    },

    update: function (dt) {
      if (!this.initialized || C.state.paused) return;
      // Fixed-step simulation: avoid running all citizen logic on every display frame.
      this.simTimer += Math.min(dt, 0.1);
      this.thinkTimer += dt;
      this.redrawTimer += dt;
      this.buildingsCacheTimer += dt;
      this.animationTime += dt;

      if (this.buildingsCacheTimer >= 5) {
        this.buildingsCacheTimer = 0;
        this.buildingsCache = [];
        for (let y = 0; y < C.world.height; y++) {
          const row = C.world.tiles[y];
          for (let x = 0; x < C.world.width; x++) {
            const tile = row[x];
            if (tile && tile.building && tile.building.type !== "city_center") {
              this.buildingsCache.push({ x: x + 0.5, y: y + 0.5, type: tile.building.type,
                workers: tile.building.workers || 0 });
            }
          }
        }
      }

      const think = this.thinkTimer >= this.decisionInterval;
      if (think) this.thinkTimer = 0;
      let steps = 0;
      while (this.simTimer >= 0.1 && steps < 1) {
        this.simTimer -= 0.1;
        steps++;
        const site = this.activeSite();
        let arrivedBuilders = 0;

        for (const agent of this.agents) {
          agent.decisionTimer = (agent.decisionTimer || 0) + 0.05;
          if (think || agent.decisionTimer >= this.decisionInterval) {
            agent.decisionTimer = 0;
            if (agent.role === "builder" && site) {
              agent.activity = "building";
              agent.targetX = site.x + 0.5 + (agent.id % 2 ? 0.18 : -0.18);
              agent.targetY = site.y + 0.55 + (agent.id % 3) * 0.12;
            } else if (agent.role !== "builder") {
              this.chooseResidentTask(agent);
            } else {
              agent.activity = "wandering";
              this.chooseWanderTargetsFor(agent);
            }
            agent.hunger = Math.min(100, (agent.hunger || 0) + 0.04);
          }

          const dx = agent.targetX - agent.x;
          const dy = agent.targetY - agent.y;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq > 0.0009) {
            const distance = Math.sqrt(distanceSq);
            const speed = agent.role === "builder" && site ? 2.0 : 0.58;
            const step = Math.min(distance, 0.1 * speed);
            agent.x += dx / distance * step;
            agent.y += dy / distance * step;
            agent.direction = dx < 0 ? -1 : 1;
            agent.walk += 0.5;
          } else if (agent.activity === "working") {
            agent.walk += 0.08;
            if (agent.targetType === "farm" || agent.targetType === "fishery" || agent.targetType === "market") {
              agent.hunger = Math.max(0, (agent.hunger || 0) - 0.22);
            }
          }
          if (agent.role === "builder" && site) {
            const bx = agent.x - (site.x + 0.5);
            const by = agent.y - (site.y + 0.6);
            if (bx * bx + by * by < 0.64) arrivedBuilders++;
          }
        }
        if (site) site.buildersPresent = arrivedBuilders;
      }

      // Redraw only the map canvas. ui.draw() also redraws all 16,384 minimap tiles,
      // which was needlessly repeated during every citizen animation refresh.
      if (this.redrawTimer >= 0.35) {
        this.redrawTimer = 0;
        if (C.ui && C.ui.ctx && C.world && C.world.draw) C.world.draw(C.ui.ctx);
      }
    },

    chooseResidentTask: function (agent) {
      // Pick a nearby staffed workplace occasionally; no per-frame world scans or pathfinding.
      let best = null;
      let bestScore = Infinity;
      for (const place of this.buildingsCache) {
        if (place.workers <= 0) continue;
        const dx = place.x - agent.x;
        const dy = place.y - agent.y;
        const distance = dx * dx + dy * dy;
        const isFood = place.type === "farm" || place.type === "fishery" || place.type === "market";
        const score = distance + ((agent.hunger || 0) > 25 && !isFood ? 18 : 0) -
          ((agent.hunger || 0) > 25 && isFood ? 12 : 0);
        if (score < bestScore && distance < 100) {
          best = place;
          bestScore = score;
        }
      }
      if (best && Math.random() < 0.62) {
        agent.targetX = best.x + (Math.random() - 0.5) * 0.5;
        agent.targetY = best.y + 0.7;
        agent.targetType = best.type;
        agent.activity = "working";
      } else {
        agent.activity = "wandering";
        agent.targetType = null;
        this.chooseWanderTargetsFor(agent);
      }
    },

    chooseWanderTargetsFor: function (agent) {
      const center = C.city.center || { x: 24, y: 24 };
      const angle = Math.random() * Math.PI * 2;
      const distance = 1 + Math.random() * 4.5;
      const x = Math.max(1, Math.min(C.world.width - 2, Math.round(center.x + Math.cos(angle) * distance)));
      const y = Math.max(1, Math.min(C.world.height - 2, Math.round(center.y + Math.sin(angle) * distance)));
      const tile = C.world.get(x, y);
      if (tile && tile.type !== "water") {
        agent.targetX = x + 0.5;
        agent.targetY = y + 0.5;
      }
    },

    selectPlan: function () {
      const population = C.city.population;
      const housing = C.city.housing;
      let count = {};
      for (const row of C.world.tiles) for (const tile of row) {
        if (tile.building) count[tile.building.type] = (count[tile.building.type] || 0) + 1;
      }
      const resources = C.state.resources;
      // The current prototype has five visible citizen agents. Keep the first
      // settlement compact until population simulation can spawn more agents.
      if (!count.farm && resources.wood >= 12 && resources.stone >= 4) return "farm";
      if (!count.lumber && resources.wood >= 18 && resources.stone >= 5) return "lumber";
      if (!count.quarry && resources.wood >= 10 && resources.stone >= 8) return "quarry";
      if (population >= housing - 1 && population < 15 && resources.food >= 8 && resources.wood >= 24 && resources.stone >= 8) return "house";
      if (!count.fishery && resources.food < 18 && resources.wood >= 20 && resources.stone >= 6) return "fishery";
      if (!count.market && resources.wood >= 30 && resources.stone >= 12 && population >= 12) return "market";
      if (!count.warehouse && resources.wood >= 35 && resources.stone >= 20) return "warehouse";
      return null;
    },

    findSite: function (type) {
      const definition = C.buildings.catalog[type];
      const center = C.city.center || { x: 24, y: 24 };
      let best = null;
      let bestScore = Infinity;
      for (let y = 1; y < C.world.height - 1; y++) {
        for (let x = 1; x < C.world.width - 1; x++) {
          const tile = C.world.get(x, y);
          if (!tile || tile.building || tile.road || tile.construction) continue;
          if (!definition.terrain.includes(tile.type)) continue;
          if (definition.requiresDeposit && tile.deposit !== definition.requiresDeposit) continue;
          if (definition.requiresResearch && (!C.research || !C.research.isCompleted(definition.requiresResearch))) continue;
          if (C.terrain && !C.terrain.canBuild(definition, x, y)) continue;
          const distance = Math.abs(x - center.x) + Math.abs(y - center.y);
          if (distance < 2 || distance > 10) continue;
          // Leave breathing room around houses; other buildings need at
          // least one clear tile so their footprints do not visually collide.
          const spacing = type === "house" ? 2 : 1;
          let nearby = 0;
          let blocked = false;
          for (let oy = -spacing; oy <= spacing; oy++) {
            for (let ox = -spacing; ox <= spacing; ox++) {
              if (!ox && !oy) continue;
              const neighbor = C.world.get(x + ox, y + oy);
              if (neighbor && (neighbor.building || neighbor.construction)) {
                nearby++;
                if (Math.max(Math.abs(ox), Math.abs(oy)) <= spacing) blocked = true;
              }
            }
          }
          if (blocked) continue;
          // Positive penalty spreads buildings instead of rewarding clusters.
          const score = distance + nearby * 1.25 + Math.abs(x - center.x) * 0.015;
          if (score < bestScore) { bestScore = score; best = { x, y }; }
        }
      }
      return best;
    },

    startConstruction: function (type) {
      const definition = C.buildings.catalog[type];
      const point = this.findSite(type);
      if (!definition || !point) return false;
      const resources = C.state.resources;
      for (const key in definition.cost) if ((resources[key] || 0) < definition.cost[key]) return false;
      for (const key in definition.cost) resources[key] -= definition.cost[key];
      const tile = C.world.get(point.x, point.y);
      tile.construction = {
        type: type,
        progress: 0,
        required: type === "house" ? 5 : 6,
        stage: 0
      };
      this.sites.push({ x: point.x, y: point.y, type: type, buildersPresent: 0 });
      C.log("Жители начали строительство: " + definition.name + ".");
      C.emit("resources");
      C.emit("citizens");
      C.emit("world");
      return true;
    },

    connectTrail: function (targetX, targetY) {
      const start = C.city.center;
      if (!start) return;
      const total = C.world.width * C.world.height;
      const previous = new Int32Array(total); previous.fill(-1);
      const queue = new Int32Array(total); let head = 0, tail = 0;
      const id = (x,y) => y * C.world.width + x;
      const startId = id(start.x,start.y), targetId = id(targetX,targetY);
      previous[startId] = startId; queue[tail++] = startId;
      const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
      while (head < tail && previous[targetId] === -1) {
        const current = queue[head++], x = current % C.world.width, y = Math.floor(current / C.world.width);
        for (const d of dirs) {
          const nx=x+d[0],ny=y+d[1],tile=C.world.get(nx,ny);
          if (!tile || tile.type === "water" || previous[id(nx,ny)] !== -1) continue;
          if (tile.building && id(nx,ny) !== targetId) continue;
          const next=id(nx,ny); previous[next]=current; queue[tail++]=next;
        }
      }
      if (previous[targetId] === -1) return;
      let cursor=targetId;
      while (cursor !== startId) {
        const x=cursor % C.world.width,y=Math.floor(cursor / C.world.width),tile=C.world.get(x,y);
        if (tile && !tile.building && !tile.road) { tile.road=true; tile.trail=true; }
        cursor=previous[cursor];
      }
      if (C.infrastructure) C.infrastructure.updateNetwork();
      C.emit("world");
      C.log("ИИ проложил тропинку к новому зданию.");
    },

    requestBuilding: function (type) {
      const definition = C.buildings.catalog[type];
      if (!definition || type === "city_center") return { ok: false, message: "Такое здание нельзя заказать." };
      if (definition.requiresResearch && (!C.research || !C.research.isCompleted(definition.requiresResearch))) return { ok: false, message: "Сначала требуется исследование «" + definition.requiresResearch + "»." };
      this.orders.push({ kind: "building", type: type });
      C.emit("construction");
      C.log("Заказано строительство: " + definition.name + ". ИИ выполнит заказ, когда найдёт участок и накопит материалы.");
      return { ok: true, message: "Заказ добавлен в очередь." };
    },

    requestUpgrade: function (x, y) {
      const tile = C.world.get(x, y);
      if (!tile || !tile.building || tile.building.type === "city_center") return { ok: false, message: "Выбери обычное здание для улучшения." };
      const level = Math.max(1, Number(tile.building.level) || 1);
      if (level >= 3) return { ok: false, message: "Здание уже достигло максимального уровня." };
      if (this.orders.some(order => order.kind === "upgrade" && order.x === x && order.y === y)) return { ok: false, message: "Улучшение уже находится в очереди." };
      this.orders.push({ kind: "upgrade", x: x, y: y, targetLevel: level + 1 });
      C.emit("construction");
      C.log("Заказано улучшение здания до уровня " + (level + 1) + ".");
      return { ok: true, message: "Улучшение добавлено в очередь." };
    },

    startUpgrade: function (order) {
      const tile = C.world.get(order.x, order.y);
      if (!tile || !tile.building || tile.construction) return false;
      const level = Math.max(1, Number(tile.building.level) || 1);
      if (level >= 3) return false;
      const cost = { wood: 12 * level, stone: 8 * level };
      const resources = C.state.resources;
      if (resources.wood < cost.wood || resources.stone < cost.stone) return false;
      resources.wood -= cost.wood; resources.stone -= cost.stone;
      tile.construction = { type: tile.building.type, upgrade: true, targetLevel: level + 1, progress: 0, required: 8, stage: 0 };
      this.sites.push({ x: order.x, y: order.y, type: tile.building.type, upgrade: true, buildersPresent: 0 });
      C.emit("resources"); C.emit("world");
      return true;
    },

    daily: function () {
      const site = this.activeSite();
      if (site) {
        const tile = C.world.get(site.x, site.y);
        if (!tile || !tile.construction) {
          this.sites.shift();
        } else {
          const workers = Math.min(4, site.buildersPresent || 0);
          if (workers > 0) {
            tile.construction.progress = Math.min(tile.construction.required,
              tile.construction.progress + workers / 3);
            tile.construction.stage = Math.min(3,
              Math.floor(tile.construction.progress / tile.construction.required * 4));
          }
          if (tile.construction.progress >= tile.construction.required) {
            const type = tile.construction.type;
            const isUpgrade = !!tile.construction.upgrade;
            if (isUpgrade && tile.building) {
              tile.building.level = tile.construction.targetLevel;
              C.log("Здание улучшено до уровня " + tile.building.level + ": " + C.buildings.catalog[type].name + ".");
            } else {
              tile.building = { type: type, workers: 0, level: 1 };
              C.log("Строительство завершено: " + C.buildings.catalog[type].name + ".");
            }
            tile.construction = null;
            this.sites.shift();
            C.city.recalculate();
            if (C.infrastructure) C.infrastructure.updateNetwork();
            this.connectTrail(site.x, site.y);
            C.emit("city");
            C.emit("world");
          }
        }
      }

      if (!this.sites.length && this.orders.length) {
        const order = this.orders[0];
        const started = order.kind === "upgrade" ? this.startUpgrade(order) : this.startConstruction(order.type);
        if (started) this.orders.shift();
      }
      if (!this.sites.length && !this.orders.length) {
        const plan = this.selectPlan();
        if (plan) this.startConstruction(plan);
      }
      C.emit("construction");
      C.emit("citizens");
    },

    drawConstruction: function (ctx, x, y, cell, construction) {
      const stage = Math.max(0, Math.min(3, construction.stage || 0));
      const material = construction.type === "quarry" ? "stone" : "wood";
      const spriteId = "construction_" + material + "_" + stage;
      if (cell >= 13 && C.spriteAssets && C.spriteAssets.draw(
          spriteId, ctx, x - cell*.197, y - cell*.426, cell*1.066, cell*1.066)) {
        const ratio = Math.max(0, Math.min(1, construction.progress / construction.required));
        ctx.fillStyle = "rgba(20,18,16,.78)";
        ctx.fillRect(x + cell*.12, y + cell*.88, cell*.76, Math.max(2, cell*.07));
        ctx.fillStyle = "#e7bd67";
        ctx.fillRect(x + cell*.12, y + cell*.88, cell*.76*ratio, Math.max(2, cell*.07));
        return;
      }
      const unit = Math.max(1, Math.round(cell / 18));
      const block = (bx, by, w, h, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(bx / unit) * unit, Math.round(by / unit) * unit,
          Math.max(unit, Math.round(w / unit) * unit), Math.max(unit, Math.round(h / unit) * unit));
      };
      block(x + cell*.13, y + cell*.69, cell*.74, cell*.12, "#514537");
      block(x + cell*.18, y + cell*.58, cell*.64, cell*.08, "#b18a55");
      if (stage >= 1) {
        block(x + cell*.22, y + cell*.35, cell*.10, cell*.34, "#79583b");
        block(x + cell*.68, y + cell*.35, cell*.10, cell*.34, "#79583b");
        block(x + cell*.28, y + cell*.34, cell*.44, cell*.08, "#9b7048");
      }
      if (stage >= 2) {
        block(x + cell*.25, y + cell*.22, cell*.50, cell*.10, "#a36b48");
        block(x + cell*.20, y + cell*.31, cell*.60, cell*.08, "#c09a68");
      }
      if (stage >= 3) {
        block(x + cell*.16, y + cell*.25, cell*.68, cell*.18, "#914f3d");
      }
      ctx.fillStyle = "#f4e5bd";
      ctx.font = "bold " + Math.max(7, cell*.17) + "px Arial";
      ctx.textAlign = "center";
      ctx.fillText("СТРОЙКА", x + cell*.5, y + cell*.94);
    },

    draw: function (ctx, camera, cell, x0, y0, x1, y1) {
      if (!this.initialized || cell < 9) return;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const tile = C.world.get(x, y);
        if (!tile || !tile.construction) continue;
        this.drawConstruction(ctx, camera.x + x*cell, camera.y + y*cell, cell, tile.construction);
      }

      // Villagers are deliberately tiny 3x5 pixel sprites. Their only visual
      // animation is a gentle one-pixel vertical bob; no limb/walk-cycle drawing.
      const unit = Math.max(1, Math.floor(cell / 22));
      const bobPhase = this.animationTime * 1.7;
      for (let i = 0; i < this.agents.length; i++) {
        const agent = this.agents[i];
        const px = Math.round(camera.x + agent.x * cell);
        const py = Math.round(camera.y + agent.y * cell);
        const bob = Math.round(Math.sin(bobPhase + agent.id * 1.37)) * unit;
        const x = px - unit;
        const y = py - 2 * unit + bob;

        // Five compact pixel rows: hair, face, tunic, tunic, feet.
        ctx.fillStyle = "#49382d";
        ctx.fillRect(x + unit, y, unit, unit);
        ctx.fillStyle = agent.color || "#d9a36d";
        ctx.fillRect(x, y + unit, unit * 3, unit);
        ctx.fillStyle = agent.shirt || "#547b91";
        ctx.fillRect(x, y + unit * 2, unit * 3, unit * 2);
        ctx.fillStyle = "#514638";
        ctx.fillRect(x + unit, y + unit * 4, unit, unit);
        if (agent.role === "builder") {
          ctx.fillStyle = "#d5b36a";
          ctx.fillRect(x, y - unit, unit * 3, unit);
        }
        // A tiny axe swing and wood chips make lumber work readable at map scale.
        if (agent.activity === "working" && agent.targetType === "lumber") {
          const swing = Math.sin(this.animationTime * 8 + agent.id) > 0;
          ctx.fillStyle = "#765238";
          ctx.fillRect(x + unit * 3, y + unit * 2, unit, swing ? unit * 2 : unit);
          ctx.fillStyle = "#c7cbd0";
          ctx.fillRect(x + unit * 3, y + (swing ? unit * 3 : unit), unit, unit);
          if (swing) {
            ctx.fillStyle = "#e7c77a";
            ctx.fillRect(x + unit * 4, y + unit * 3, unit, unit);
          }
        }
      }
    },

    exportData: function () {
      return {
        nextId: this.nextId,
        agents: this.agents.map(agent => ({
          id: agent.id, role: agent.role, x: agent.x, y: agent.y,
          targetX: agent.targetX, targetY: agent.targetY, direction: agent.direction,
          color: agent.color, shirt: agent.shirt, walk: agent.walk,
          activity: agent.activity || "wandering", hunger: agent.hunger || 0
        })),
        sites: this.sites.map(site => { const tile = C.world.get(site.x, site.y); const build = tile && tile.construction; return { x: site.x, y: site.y, type: site.type, upgrade: !!(build && build.upgrade), targetLevel: build && build.targetLevel, progress: build ? build.progress : 0, required: build ? build.required : 5, stage: build ? build.stage : 0 }; }),
        orders: this.orders.map(order => Object.assign({}, order))
      };
    },

    importData: function (data) {
      if (!data || !Array.isArray(data.agents)) return false;
      this.agents = data.agents.filter(agent =>
        Number.isFinite(agent.x) && Number.isFinite(agent.y) &&
        agent.x >= 0 && agent.y >= 0 && agent.x < C.world.width && agent.y < C.world.height
      ).map(agent => Object.assign({}, agent));
      this.orders = Array.isArray(data.orders) ? data.orders.filter(order => order && (order.kind === "building" ? C.buildings.catalog[order.type] : order.kind === "upgrade" && Number.isInteger(order.x) && Number.isInteger(order.y))).slice(0, 12) : [];
      this.sites = Array.isArray(data.sites) ? data.sites.filter(site => {
        const tile = C.world.get(site.x, site.y);
        return tile && !tile.building && C.buildings.catalog[site.type] &&
          Number.isFinite(site.x) && Number.isFinite(site.y);
      }).map(site => {
        const tile = C.world.get(site.x, site.y);
        tile.construction = {
          type: site.type,
          upgrade: !!site.upgrade,
          targetLevel: Math.max(2, Number(site.targetLevel) || 2),
          progress: Math.max(0, Number(site.progress) || 0),
          required: Math.max(1, Number(site.required) || 5),
          stage: Math.max(0, Math.min(3, Number(site.stage) || 0))
        };
        return { x: site.x, y: site.y, type: site.type, upgrade: !!site.upgrade, buildersPresent: 0 };
      }) : [];
      this.nextId = Math.max(1, Number(data.nextId) || this.agents.length + 1);
      this.buildingsCache = [];
      this.buildingsCacheTimer = 5;
      this.initialized = true;
      return true;
    }
  };

  C.citizens = system;
})();