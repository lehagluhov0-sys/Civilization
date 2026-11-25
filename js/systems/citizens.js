(function () {
  "use strict";
  const C = window.Civ;
  const directions = [[1,0],[-1,0],[0,1],[0,-1]];

  const system = {
    agents: [],
    sites: [],
    nextId: 1,
    animationTime: 0,
    redrawTimer: 0,
    initialized: false,

    init: function () {
      if (this.initialized) return;
      this.initialized = true;
      if (this.agents.length) return;
      const center = C.city.center || { x: 24, y: 24 };
      for (let i = 0; i < 14; i++) {
        const angle = i * 2.399963;
        const radius = 0.7 + (i % 4) * 0.38;
        const x = Math.max(1, Math.min(C.world.width - 2, center.x + Math.cos(angle) * radius));
        const y = Math.max(1, Math.min(C.world.height - 2, center.y + Math.sin(angle) * radius));
        this.agents.push({
          id: this.nextId++,
          role: i < 4 ? "builder" : "resident",
          x: x, y: y,
          targetX: x, targetY: y,
          direction: 1,
          walk: Math.random() * 6.28,
          color: ["#d9a36d", "#c77d57", "#e1c28b", "#9a654d"][i % 4],
          shirt: ["#547b91", "#8b604d", "#6d8051", "#a18b55", "#76618f"][i % 5]
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
      if (!this.initialized) return;
      this.animationTime += dt;
      this.redrawTimer += dt;
      const site = this.activeSite();
      let arrivedBuilders = 0;

      this.agents.forEach(agent => {
        if (agent.role === "builder" && site) {
          agent.targetX = site.x + 0.5 + (agent.id % 2 ? 0.18 : -0.18);
          agent.targetY = site.y + 0.55 + (agent.id % 3) * 0.12;
        } else if (Math.hypot(agent.targetX - agent.x, agent.targetY - agent.y) < 0.12) {
          if (Math.random() < dt * 0.55) this.chooseWanderTargetsFor(agent);
        }

        const dx = agent.targetX - agent.x;
        const dy = agent.targetY - agent.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0.025) {
          const step = Math.min(distance, dt * (agent.role === "builder" && site ? 2.3 : 0.72));
          agent.x += dx / distance * step;
          agent.y += dy / distance * step;
          agent.direction = dx < 0 ? -1 : 1;
          agent.walk += dt * 10;
        }
        if (agent.role === "builder" && site &&
            Math.hypot(agent.x - (site.x + 0.5), agent.y - (site.y + 0.6)) < 0.8) arrivedBuilders++;
      });

      if (site) site.buildersPresent = arrivedBuilders;
      if (this.redrawTimer >= 0.09) {
        this.redrawTimer = 0;
        if (C.ui && C.ui.draw) C.ui.draw();
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
      if (housing <= population + 5 && resources.wood >= 20 && resources.stone >= 5 && resources.money >= 25) return "house";
      if ((!count.farm || resources.food < 105) && resources.wood >= 15 && resources.stone >= 5 && resources.money >= 20) return "farm";
      if (!count.lumber && resources.wood < 55 && resources.stone >= 10 && resources.money >= 30) return "lumber";
      if (!count.quarry && resources.stone < 40 && resources.wood >= 10 && resources.money >= 30) return "quarry";
      if (housing < population + 18 && resources.wood >= 20 && resources.stone >= 5 && resources.money >= 25) return "house";
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
          if (C.terrain && !C.terrain.canBuild(definition, x, y)) continue;
          const distance = Math.abs(x - center.x) + Math.abs(y - center.y);
          if (distance < 2 || distance > 10) continue;
          let nearby = 0;
          for (const [dx,dy] of directions) {
            const neighbor = C.world.get(x + dx, y + dy);
            if (neighbor && neighbor.building) nearby += 1;
          }
          const score = distance - nearby * 1.8 + Math.abs(x - center.x) * 0.015;
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
              tile.construction.progress + workers / 2);
            tile.construction.stage = Math.min(3,
              Math.floor(tile.construction.progress / tile.construction.required * 4));
          }
          if (tile.construction.progress >= tile.construction.required) {
            const type = tile.construction.type;
            tile.building = { type: type, workers: 0 };
            tile.construction = null;
            this.sites.shift();
            C.city.recalculate();
            if (C.infrastructure) C.infrastructure.updateNetwork();
            C.log("Строительство завершено: " + C.buildings.catalog[type].name + ".");
            C.emit("city");
            C.emit("world");
          }
        }
      }

      if (!this.sites.length) {
        const plan = this.selectPlan();
        if (plan) this.startConstruction(plan);
      }
      C.emit("citizens");
    },

    drawConstruction: function (ctx, x, y, cell, construction) {
      const stage = construction.stage || 0;
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

      const sorted = this.agents.slice().sort((a,b) => a.y - b.y);
      sorted.forEach(agent => {
        const px = camera.x + agent.x * cell;
        const py = camera.y + agent.y * cell;
        const size = Math.max(1.5, cell * 0.115);
        const bob = Math.sin(agent.walk) * size * 0.22;
        ctx.fillStyle = "#263027";
        ctx.globalAlpha = 0.34;
        ctx.fillRect(px - size*.55, py + size*1.55, size*1.1, size*.34);
        ctx.globalAlpha = 1;
        ctx.fillStyle = agent.shirt;
        ctx.fillRect(px - size*.48, py - size*.05 + bob, size*.96, size*1.05);
        ctx.fillStyle = agent.color;
        ctx.fillRect(px - size*.35, py - size*.72 + bob, size*.70, size*.68);
        ctx.fillStyle = "#49382d";
        ctx.fillRect(px - size*.40, py - size*.83 + bob, size*.80, size*.20);
        if (agent.role === "builder") {
          ctx.fillStyle = "#d5b36a";
          ctx.fillRect(px + size*.40, py + size*.12 + bob, size*.42, size*.38);
        }
        ctx.fillStyle = "#263027";
        ctx.fillRect(px - size*.34, py + size*.90 + bob, size*.24, size*.58);
        ctx.fillRect(px + size*.10, py + size*.90 - bob, size*.24, size*.58);
      });
    },

    exportData: function () {
      return {
        nextId: this.nextId,
        agents: this.agents.map(agent => ({
          id: agent.id, role: agent.role, x: agent.x, y: agent.y,
          targetX: agent.targetX, targetY: agent.targetY, direction: agent.direction,
          color: agent.color, shirt: agent.shirt, walk: agent.walk
        })),
        sites: this.sites.map(site => ({ x: site.x, y: site.y, type: site.type }))
      };
    },

    importData: function (data) {
      if (!data || !Array.isArray(data.agents)) return false;
      this.agents = data.agents.filter(agent =>
        Number.isFinite(agent.x) && Number.isFinite(agent.y) &&
        agent.x >= 0 && agent.y >= 0 && agent.x < C.world.width && agent.y < C.world.height
      ).map(agent => Object.assign({}, agent));
      this.sites = Array.isArray(data.sites) ? data.sites.filter(site => {
        const tile = C.world.get(site.x, site.y);
        return tile && tile.construction && C.buildings.catalog[site.type];
      }).map(site => Object.assign({}, site, { buildersPresent: 0 })) : [];
      this.nextId = Math.max(1, Number(data.nextId) || this.agents.length + 1);
      this.initialized = true;
      return true;
    }
  };

  C.citizens = system;
})();