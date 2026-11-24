(function () {
  "use strict";
  const C = window.Civ;
  const $ = id => document.getElementById(id);

  C.ui = {
    init: function () {
      this.canvas = $("worldCanvas");
      this.ctx = this.canvas.getContext("2d");
      this.mini = $("miniMap").getContext("2d");
      this.roadMode = false;
      this.bind();

      C.on("time", () => this.refresh());
      C.on("camera", () => this.refreshZoom());
      C.on("log", message => this.addLog(message));
      C.on("selection", () => this.refreshSelection());
      C.on("resources", () => this.refreshResources());
      C.on("economy", () => this.refreshEconomy());
      C.on("workforce", () => this.refreshWorkforce());
      C.on("infrastructure", () => {
        this.refreshInfrastructure();
        this.refreshEconomy();
      });
      C.on("city", () => {
        this.refreshResources();
        this.refreshWorkforce();
        this.refreshInfrastructure();
      });
      C.on("world", () => this.draw());
      C.on("research", () => { if (this.researchPanel) this.renderResearchPanel(); });
      C.on("diplomacy", () => { if (this.diplomacyPanel) this.renderDiplomacyPanel(); });
      C.on("politics", () => { if (this.worldPanel) this.renderWorldPanel(); this.draw(); });

      this.refresh();
    },

    bind: function () {
      const canvas = this.canvas;
      let pointer = null;

      canvas.addEventListener("pointerdown", event => {
        const rect = canvas.getBoundingClientRect();
        const startX = event.clientX - rect.left;
        const startY = event.clientY - rect.top;
        pointer = {
          startX: startX,
          startY: startY,
          lastX: startX,
          lastY: startY,
          lastRoadTile: null,
          moved: false,
          road: this.roadMode
        };
        canvas.setPointerCapture(event.pointerId);
        if (pointer.road) {
          const tile = C.camera.screenToTile(startX, startY);
          pointer.lastRoadTile = tile;
          this.paintRoadLine(tile, tile);
        }
      });

      canvas.addEventListener("pointermove", event => {
        if (!pointer) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const dx = x - pointer.lastX;
        const dy = y - pointer.lastY;

        if (Math.hypot(x - pointer.startX, y - pointer.startY) > 5) pointer.moved = true;
        if (pointer.road) {
          const tile = C.camera.screenToTile(x, y);
          if (!pointer.lastRoadTile || tile.x !== pointer.lastRoadTile.x || tile.y !== pointer.lastRoadTile.y) {
            this.paintRoadLine(pointer.lastRoadTile || tile, tile);
            pointer.lastRoadTile = tile;
          }
          this.draw();
        } else if (pointer.moved) {
          C.state.camera.x += dx;
          C.state.camera.y += dy;
          this.draw();
        }

        pointer.lastX = x;
        pointer.lastY = y;
        const tile = C.camera.screenToTile(x, y);
        $("coordinates").textContent = "X: " + (tile.x + 1) + " Y: " + (tile.y + 1);
      });

      const endPointer = event => {
        if (!pointer) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        if (!pointer.road && !pointer.moved) {
          const tile = C.camera.screenToTile(x, y);
          if (C.world.get(tile.x, tile.y)) {
            C.state.selected = tile;
            C.emit("selection");
            this.draw();
          }
        }
        if (pointer.moved && !pointer.road) C.emit("camera");
        pointer = null;
      };

      canvas.addEventListener("pointerup", endPointer);
      canvas.addEventListener("pointercancel", () => { pointer = null; });
      canvas.addEventListener("wheel", event => {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        C.camera.zoomAt(
          event.deltaY < 0 ? 1.12 : 0.89,
          event.clientX - rect.left,
          event.clientY - rect.top
        );
        this.draw();
      }, { passive: false });

      $("zoomIn").onclick = () => {
        C.camera.zoomAt(1.15, C.camera.width / 2, C.camera.height / 2);
        this.draw();
      };
      $("zoomOut").onclick = () => {
        C.camera.zoomAt(0.87, C.camera.width / 2, C.camera.height / 2);
        this.draw();
      };
      $("centerButton").onclick = () => {
        C.camera.center();
        C.emit("camera");
        this.draw();
      };
      $("clearSelectionButton").onclick = () => {
        C.state.selected = null;
        C.emit("selection");
        this.draw();
      };
      $("roadModeButton").onclick = () => {
        this.roadMode = !this.roadMode;
        this.refreshRoadMode();
        this.addLog(this.roadMode
          ? "Режим дорог включён. Проведи пальцем по карте, чтобы проложить маршрут."
          : "Режим прокладки дорог выключен.");
      };
      $("gridToggle").onchange = event => {
        C.state.showGrid = event.target.checked;
        C.emit("settings");
        this.draw();
      };
      $("politicalLayerToggle").onchange = event => {
        C.state.showPoliticalMap = event.target.checked;
        C.emit("settings");
        this.draw();
      };
      $("pauseButton").onclick = () => {
        C.state.paused = !C.state.paused;
        C.emit("settings");
        this.refreshTime();
      };

      document.querySelectorAll(".speed-button").forEach(button => {
        button.onclick = () => {
          C.state.speed = Number(button.dataset.speed);
          C.state.paused = false;
          C.emit("settings");
          this.refreshTime();
        };
      });

      document.querySelectorAll(".nav-button").forEach(button => {
        button.type = "button";
        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();

          document.querySelectorAll(".nav-button").forEach(item => {
            item.classList.toggle("active", item === button);
          });

          const section = button.dataset.section;
          if (section === "city") {
            this.addLog("Выбран раздел управления поселением.");
            if (C.city.center) C.state.selected = { x: C.city.center.x, y: C.city.center.y };
            C.emit("selection");
            this.draw();
          } else if (section === "map") {
            this.closeResearchPanel();
            this.closeDiplomacyPanel();
            this.closeWorldPanel();
            this.addLog("Открыта карта мира.");
          } else if (section === "research") {
            this.closeDiplomacyPanel();
            this.openResearchPanel();
          } else if (section === "world") {
            this.closeResearchPanel();
            this.closeDiplomacyPanel();
            this.openWorldPanel();
          } else if (section === "diplomacy") {
            this.closeResearchPanel();
            this.closeWorldPanel();
            this.openDiplomacyPanel();
          } else {
            this.addLog("Раздел «" + button.textContent.trim() + "» будет добавлен на следующем этапе.");
          }
        }, { passive: false });
      });

      $("taxRate").oninput = event => {
        C.economy.setTaxRate(event.target.value);
        this.refreshEconomy();
      };
      $("menuButton").onclick = () => {
        const saved = C.save && C.save.save();
        this.addLog(saved ? "Игра сохранена на устройстве." : "Не удалось сохранить игру. Проверь доступное место и настройки браузера.");
      };
    },



    openWorldPanel: function () {
      if (!C.politics) { this.addLog("Политическая карта не загружена."); return; }
      if (!this.worldPanel) {
        const panel = document.createElement("div");
        panel.id = "worldOverlay";
        panel.style.cssText = "position:fixed;inset:0;z-index:520;background:rgba(5,9,13,.90);display:flex;align-items:center;justify-content:center;padding:10px;";
        panel.innerHTML = '<div style="width:min(820px,100%);max-height:94%;overflow:auto;background:#1b242d;border:1px solid #c69b55;padding:14px;color:#e8edf1"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><b style="letter-spacing:2px">МИРОВАЯ ПОЛИТИКА</b><button id="closeWorld" class="wide-button" style="width:auto">Закрыть ✕</button></div><div id="worldContent"></div></div>';
        document.body.appendChild(panel);
        this.worldPanel = panel;
        panel.querySelector("#closeWorld").onclick = () => this.closeWorldPanel();
      }
      this.renderWorldPanel();
    },

    closeWorldPanel: function () {
      if (this.worldPanel) this.worldPanel.remove();
      this.worldPanel = null;
    },

    renderWorldPanel: function () {
      if (!this.worldPanel || !C.politics) return;
      const content = this.worldPanel.querySelector("#worldContent");
      let html = '<p style="font-size:12px;color:#9eacb8">Государства развиваются самостоятельно. Территории определяются положением столиц и силой держав.</p>';
      html += '<div style="background:#26333e;padding:10px;margin:8px 0"><b>ТВОЁ ГОСУДАРСТВО</b><div style="font-size:12px;margin-top:5px">Территория: ' + (C.politics.playerTerritory || 0) + ' клеток · Население: ' + C.city.population + ' · Столица: ' + (C.city.center.x + 1) + ', ' + (C.city.center.y + 1) + '</div></div>';
      C.politics.countries.forEach(c => {
        const relation = C.diplomacy.get(c.id);
        html += '<div style="background:#222e39;border-left:4px solid ' + c.color + ';padding:10px;margin:8px 0">';
        html += '<div style="display:flex;justify-content:space-between;gap:8px"><b>' + c.flag + ' ' + c.name + '</b><span style="color:#d9b66f;font-size:11px">' + (relation ? C.diplomacy.relationName(relation.relation) : "Нейтралитет") + '</span></div>';
        html += '<div style="font-size:11px;color:#aebbc5;margin-top:5px">' + c.leader + ' · Столица: ' + (c.capital.x + 1) + ', ' + (c.capital.y + 1) + '</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:8px;font-size:11px"><span>Жители<br><b>' + c.population.toLocaleString("ru-RU") + '</b></span><span>Города<br><b>' + c.cities + '</b></span><span>Земли<br><b>' + c.territory + '</b></span><span>Развитие<br><b>' + c.development + '/10</b></span></div>';
        html += '<div style="height:5px;background:#111920;margin-top:8px"><div style="height:5px;width:' + c.stability + '%;background:' + c.color + '"></div></div><small style="color:#9eacb8">Стабильность ' + c.stability + '% · Казна ' + Math.floor(c.treasury) + '</small></div>';
      });
      content.innerHTML = html;
    },

    openDiplomacyPanel: function () {
      if (!C.diplomacy) {
        this.addLog("Система дипломатии не загружена.");
        return;
      }
      if (!this.diplomacyPanel) {
        const panel = document.createElement("div");
        panel.id = "diplomacyOverlay";
        panel.style.cssText = "position:fixed;inset:0;z-index:510;background:rgba(5,9,13,.90);display:flex;align-items:center;justify-content:center;padding:10px;";
        panel.innerHTML = '<div style="width:min(900px,100%);max-height:94%;overflow:auto;background:#1b242d;border:1px solid #c69b55;padding:14px;color:#e8edf1;box-shadow:0 12px 40px #0009"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;position:sticky;top:-14px;background:#1b242d;padding:4px 0 10px;z-index:2"><b style="letter-spacing:2px">МЕЖДУНАРОДНЫЕ ОТНОШЕНИЯ</b><button id="closeDiplomacy" class="wide-button" style="width:auto">Закрыть ✕</button></div><div id="diplomacyContent"></div></div>';
        document.body.appendChild(panel);
        this.diplomacyPanel = panel;
        panel.querySelector("#closeDiplomacy").onclick = () => this.closeDiplomacyPanel();
      }
      this.renderDiplomacyPanel();
    },

    closeDiplomacyPanel: function () {
      if (this.diplomacyPanel) this.diplomacyPanel.remove();
      this.diplomacyPanel = null;
    },

    renderDiplomacyPanel: function () {
      if (!this.diplomacyPanel || !C.diplomacy) return;
      const d = C.diplomacy;
      const content = this.diplomacyPanel.querySelector("#diplomacyContent");
      let html = '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:4px 0 12px">';
      html += '<div style="background:#222e39;padding:9px"><small>РЕПУТАЦИЯ</small><br><b>' + d.reputation + ' / 100</b></div>';
      html += '<div style="background:#222e39;padding:9px"><small>ВЛИЯНИЕ</small><br><b>' + d.influence + '</b></div>';
      html += '<div style="background:#222e39;padding:9px"><small>ПОСЛЫ</small><br><b>' + d.envoys + '</b></div></div>';
      html += '<p style="font-size:11px;color:#9eacb8">Репутация влияет на отношение держав. Влияние используется в международной политике. Торговые договоры дают ежедневный доход, а союзы постепенно укрепляют влияние.</p>';

      if (d.pending.length) {
        html += '<div style="border:1px solid #c69b55;padding:10px;margin:10px 0"><b>ДИПЛОМАТИЧЕСКИЕ ПРЕДЛОЖЕНИЯ</b>';
        d.pending.forEach(p => {
          const civ = d.get(p.civId);
          if (!civ) return;
          html += '<div style="background:#222e39;padding:9px;margin-top:8px"><b>' + civ.flag + ' ' + civ.name + ' — ' + p.title + '</b><p style="font-size:11px;color:#9eacb8">' + p.text + '</p><button class="wide-button" data-dip-response="' + p.id + '" data-accept="1">Принять</button><button class="wide-button" data-dip-response="' + p.id + '" data-accept="0">Отклонить</button></div>';
        });
        html += '</div>';
      }

      html += '<b>НЕЗАВИСИМЫЕ ДЕРЖАВЫ · ' + d.civilizations.length + '</b>';
      d.civilizations.forEach(civ => {
        const relation = d.relationName(civ.relation);
        const color = civ.relation >= 45 ? "#79b88d" : civ.relation < -15 ? "#d77b68" : "#d7b46b";
        const treaties = [];
        if (civ.embassy) treaties.push("Посольство");
        if (civ.trade) treaties.push("Торговля");
        if (civ.nonAggression > 0) treaties.push("Мир: " + civ.nonAggression + " дн.");
        if (civ.alliance) treaties.push("Союз");
        html += '<section style="background:#222e39;border:1px solid #34424e;padding:10px;margin:9px 0">';
        html += '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b>' + civ.flag + ' ' + civ.name + '</b><span style="font-size:10px;color:' + color + '">' + relation.toUpperCase() + '</span></div>';
        html += '<div style="font-size:11px;color:#aab6c0;margin:5px 0">Правитель: ' + civ.leader + ' · Черта: ' + civ.trait + '</div>';
        html += '<div style="height:7px;background:#11171d;margin:7px 0"><div style="height:7px;width:' + Math.max(0, Math.min(100, civ.relation + 100) / 2) + '%;background:' + color + '"></div></div>';
        html += '<div style="display:flex;justify-content:space-between;font-size:10px;color:#aab6c0"><span>Отношения: ' + civ.relation + ' / 100</span><span>Доверие: ' + civ.trust + ' / 100</span></div>';
        html += '<p style="font-size:11px;color:#9eacb8;margin:6px 0">' + civ.style + '</p>';
        html += '<p style="font-size:10px;color:#d7b46b;margin:5px 0">' + (treaties.length ? treaties.join(" · ") : "Договоров пока нет") + '</p>';
        html += '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px">';
        const actions = [
          ["greet","Установить контакт"],["embassy","Открыть посольство"],["gift","Отправить подарок · 20 мон."],
          ["trade","Торговый договор"],["pact","Пакт о ненападении"],["culture","Культурный обмен"],
          ["science","Научный обмен"],["alliance","Предложить союз"]
        ];
        actions.forEach(a => {
          const disabled = civ.cooldown > 0 || (a[0] === "embassy" && civ.embassy) ||
            (a[0] === "trade" && civ.trade) || (a[0] === "pact" && civ.nonAggression > 0) ||
            (a[0] === "alliance" && civ.alliance);
          html += '<button class="wide-button" data-dip-action="' + a[0] + '" data-civ="' + civ.id + '" ' + (disabled ? 'disabled' : '') + ' style="font-size:10px;padding:7px">' + a[1] + '</button>';
        });
        html += '</div>';
        if (civ.cooldown > 0) html += '<small style="color:#9eacb8">Перерыв между действиями: ' + civ.cooldown + ' дн.</small>';
        html += '</section>';
      });

      html += '<b>ПОСЛЕДНИЕ ДИПЛОМАТИЧЕСКИЕ СОБЫТИЯ</b>';
      if (!d.history.length) html += '<p style="font-size:11px;color:#9eacb8">Пока международных событий не было.</p>';
      d.history.slice(0, 8).forEach(item => {
        html += '<div style="border-bottom:1px solid #34424e;padding:6px 0;font-size:11px"><span style="color:#d7b46b">День ' + item.day + '</span> · ' + item.message + '</div>';
      });

      content.innerHTML = html;
      content.querySelectorAll("[data-dip-action]").forEach(button => {
        button.onclick = () => {
          const result = C.diplomacy.action(button.dataset.civ, button.dataset.dipAction);
          if (!result.ok) this.addLog(result.message);
          this.renderDiplomacyPanel();
          this.refreshResources();
        };
      });
      content.querySelectorAll("[data-dip-response]").forEach(button => {
        button.onclick = () => {
          C.diplomacy.respond(button.dataset.dipResponse, button.dataset.accept === "1");
          this.renderDiplomacyPanel();
          this.refreshResources();
        };
      });
    },

    openResearchPanel: function () {
      if (!C.research) {
        this.addLog("Система исследований не загружена.");
        return;
      }
      if (!this.researchPanel) {
        const panel = document.createElement("div");
        panel.id = "researchOverlay";
        panel.style.cssText = "position:fixed;inset:0;z-index:500;background:rgba(5,9,13,.88);display:flex;align-items:center;justify-content:center;padding:14px;";
        panel.innerHTML = '<div style="width:min(720px,100%);max-height:90%;overflow:auto;background:#1b242d;border:1px solid #c69b55;padding:16px;color:#e8edf1;box-shadow:0 12px 40px #0009"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><b style="letter-spacing:2px">НАУЧНЫЕ ИССЛЕДОВАНИЯ</b><button id="closeResearch" class="wide-button" style="width:auto">Закрыть ✕</button></div><div id="researchContent"></div></div>';
        document.body.appendChild(panel);
        this.researchPanel = panel;
        $("closeResearch").onclick = () => this.closeResearchPanel();
      }
      this.renderResearchPanel();
    },

    closeResearchPanel: function () {
      if (this.researchPanel) this.researchPanel.remove();
      this.researchPanel = null;
    },

    renderResearchPanel: function () {
      if (!this.researchPanel || !C.research) return;
      const content = this.researchPanel.querySelector("#researchContent");
      const active = C.research.getTech(C.research.activeId);
      let html = '<p style="color:#91a0ad;font-size:12px">Эпоха: Древний мир · Научные очки: <b style="color:#e0b86e">' + C.research.points.toFixed(1) + '</b> · Получение: +' + C.research.sciencePerDay() + ' в день</p>';
      if (active) {
        const percent = Math.min(100, Math.round(C.research.progress / active.cost * 100));
        html += '<div style="padding:10px;background:#222e39;border:1px solid #34424e;margin:10px 0"><b>Сейчас изучается: ' + active.name + '</b><p style="font-size:11px;color:#91a0ad">' + C.research.progress + ' / ' + active.cost + ' очков · ' + percent + '%</p><div style="height:8px;background:#11171d"><div style="height:8px;width:' + percent + '%;background:#c69b55"></div></div></div>';
      } else {
        html += '<p style="font-size:11px;color:#91a0ad">Выбери технологию, чтобы начать исследование. Очки науки накапливаются ежедневно.</p>';
      }
      C.research.catalog.forEach(tech => {
        const done = C.research.isCompleted(tech.id);
        const selected = C.research.activeId === tech.id;
        html += '<div style="padding:10px;margin:8px 0;background:#222e39;border:1px solid ' + (done ? '#79a56a' : selected ? '#c69b55' : '#34424e') + '"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><b>' + tech.name + '</b><span style="font-size:10px;color:#e0b86e">' + (done ? 'ИЗУЧЕНО' : tech.cost + ' науки') + '</span></div><p style="font-size:11px;line-height:1.4;color:#91a0ad;margin:7px 0">' + tech.description + '</p>' + (done ? '' : '<button class="wide-button" data-tech="' + tech.id + '" ' + (selected ? 'disabled' : '') + '>' + (selected ? 'Изучается' : 'Начать исследование') + '</button>') + '</div>';
      });
      content.innerHTML = html;
      content.querySelectorAll("[data-tech]").forEach(button => {
        button.onclick = () => {
          const result = C.research.start(button.dataset.tech);
          if (!result.ok) this.addLog(result.message);
          this.renderResearchPanel();
        };
      });
    },

    draw: function () {
      C.world.draw(this.ctx);
      C.world.drawMini(this.mini);
      this.refreshZoom();
    },

    refresh: function () {
      this.refreshResources();
      this.refreshEconomy();
      this.refreshWorkforce();
      this.refreshInfrastructure();
      $("season").textContent = C.time.season();
      $("day").textContent = C.state.day;
      this.refreshTime();
      this.refreshRoadMode();
      $("gridToggle").checked = C.state.showGrid;
      $("politicalLayerToggle").checked = !!C.state.showPoliticalMap;
      this.refreshSelection();
      this.draw();
    },

    refreshResources: function () {
      const resources = C.state.resources;
      $("population").textContent = C.city.population;
      $("cityPopulation").textContent = C.city.population;
      $("cityHousing").textContent = C.city.housing;
      $("cityJobs").textContent = C.city.maxJobs;
      $("buildingCount").textContent = C.city.buildingCount;
      $("money").textContent = resources.money;
      $("food").textContent = resources.food;
      $("wood").textContent = resources.wood;
      $("stone").textContent = resources.stone;
      $("storageCapacity").textContent = C.infrastructure.storageCapacity();
    },

    refreshWorkforce: function () {
      const workforce = C.workforce;
      $("laborForce").textContent = workforce.laborForce;
      $("employed").textContent = workforce.employed;
      $("unemployed").textContent = workforce.unemployed;
      $("vacantJobs").textContent = workforce.vacantJobs;
      $("farmWorkers").textContent = workforce.workersByType.farm || 0;
      $("lumberWorkers").textContent = workforce.workersByType.lumber || 0;
      $("quarryWorkers").textContent = workforce.workersByType.quarry || 0;
      $("warehouseWorkers").textContent = workforce.workersByType.warehouse || 0;
    },

    refreshInfrastructure: function () {
      $("roadCount").textContent = C.infrastructure.roadCount;
      $("connectedBuildings").textContent = C.infrastructure.connectedBuildings;
      $("storageCapacity").textContent = C.infrastructure.storageCapacity();
    },

    refreshEconomy: function () {
      if (!C.economy) return;
      const economy = C.economy.calculate();
      $("taxRate").value = C.economy.taxRate;
      $("taxRateValue").textContent = C.economy.taxRate + "%";
      $("taxIncome").textContent = economy.income.toFixed(1);
      $("buildingUpkeep").textContent = economy.buildingUpkeep.toFixed(1);
      $("roadUpkeep").textContent = economy.roadUpkeep.toFixed(2);
      $("wageCost").textContent = economy.wages.toFixed(2);
      $("dailyBalance").textContent = (economy.balance > 0 ? "+" : "") + economy.balance.toFixed(2);
      $("dailyBalance").style.color = economy.balance < 0 ? "#d97757" : economy.balance > 0 ? "#63b98b" : "";
    },

    refreshRoadMode: function () {
      const button = $("roadModeButton");
      if (!button) return;
      button.textContent = this.roadMode ? "✓ Режим дорог: ВКЛ" : "＋ Режим дорог: ВЫКЛ";
      button.classList.toggle("active", this.roadMode);
      $("mapHint").textContent = this.roadMode
        ? "РЕЖИМ ДОРОГ · ПРОВЕДИ ПАЛЬЦЕМ ПО КАРТЕ ДЛЯ ПРОКЛАДКИ МАРШРУТА"
        : "ПЕРЕТАСКИВАЙ КАРТУ · НАЖМИ НА КЛЕТКУ ДЛЯ ВЫБОРА";
    },

    paintRoadLine: function (from, to) {
      let x0 = from.x;
      let y0 = from.y;
      const x1 = to.x;
      const y1 = to.y;
      const dx = Math.abs(x1 - x0);
      const sx = x0 < x1 ? 1 : -1;
      const dy = -Math.abs(y1 - y0);
      const sy = y0 < y1 ? 1 : -1;
      let error = dx + dy;
      let failed = false;

      while (true) {
        const tile = C.world.get(x0, y0);
        if (tile && !tile.road && !tile.building && tile.type !== "water") {
          const result = C.infrastructure.buildRoad(x0, y0);
          if (!result.ok) {
            if (!failed) this.addLog(result.message);
            failed = true;
            if (result.message.indexOf("Недостаточно") !== -1) {
              this.roadMode = false;
              this.refreshRoadMode();
              break;
            }
          }
        }
        if (x0 === x1 && y0 === y1) break;
        const twice = 2 * error;
        if (twice >= dy) { error += dy; x0 += sx; }
        if (twice <= dx) { error += dx; y0 += sy; }
      }
      this.refreshResources();
      this.refreshInfrastructure();
      this.refreshEconomy();
    },

    refreshZoom: function () {
      $("zoomValue").textContent = Math.round(C.state.camera.zoom * 100) + "%";
    },

    refreshTime: function () {
      $("gameStatus").textContent = C.state.paused ? "ПАУЗА" : "ИДЁТ";
      $("pauseButton").textContent = C.state.paused ? "▶" : "Ⅱ";
      $("pauseButton").classList.toggle("active", C.state.paused);
      document.querySelectorAll(".speed-button").forEach(button => {
        button.classList.toggle("active", Number(button.dataset.speed) === C.state.speed);
      });
    },

    refreshSelection: function () {
      const element = $("selectionInfo");
      const selected = C.state.selected;
      if (!selected) {
        element.innerHTML = '<div class="empty-symbol">⌖</div><b>Ничего не выбрано</b><p>Нажми на клетку карты, чтобы посмотреть местность.</p>';
        return;
      }

      const tile = C.world.get(selected.x, selected.y);
      if (!tile) {
        element.textContent = "Неизвестная клетка";
        return;
      }

      let content =
        '<div class="terrain-preview" style="background:' + C.world.colors[tile.type] + '"></div>' +
        '<div class="terrain-name">' + C.world.names[tile.type] + '</div>' +
        '<div class="terrain-description">' + C.world.descriptions[tile.type] + '</div>' +
        '<p>Координаты: ' + (selected.x + 1) + ", " + (selected.y + 1) + "</p>";

      if (tile.building) {
        const definition = C.buildings.catalog[tile.building.type];
        content +=
          '<div class="panel-divider"></div><div class="section-label">ЗДАНИЕ</div>' +
          '<b>' + definition.name + "</b><p>" + definition.description + "</p>";
        if (definition.jobs) {
          content += "<p>Работники: " + (tile.building.workers || 0) + " / " + definition.jobs + "</p>";
          content += "<p>Дорожная связь: " + (C.infrastructure.isConnected(tile.x, tile.y) ? "есть" : "нет · выпуск 50%") + "</p>";
        }
        if (definition.storage) content += "<p>Вместимость: +" + definition.storage + "</p>";
      } else if (tile.road) {
        content += '<div class="panel-divider"></div><div class="section-label">ИНФРАСТРУКТУРА</div><b>Дорога</b><p>Соединяет здания с центром поселения, если входит в связанную сеть.</p>';
      } else {
        content += '<div class="panel-divider"></div><div class="section-label">СТРОИТЕЛЬСТВО</div>';
        let hasAction = false;

        Object.keys(C.buildings.catalog).forEach(type => {
          if (type === "city_center") return;
          const definition = C.buildings.catalog[type];
          if (!definition.terrain.includes(tile.type)) return;
          hasAction = true;
          const cost = definition.cost;
          content +=
            '<button class="wide-button build-button" data-building="' + type + '">' +
            definition.name +
            '<small class="build-cost">Д ' + (cost.wood || 0) + " · К " + (cost.stone || 0) +
            " · Мон " + (cost.money || 0) + "</small></button>";
        });

        if (tile.type !== "water") {
          hasAction = true;
          content += '<button class="wide-button build-button road-button" data-action="road">Проложить дорогу' +
            '<small class="build-cost">Д 3 · Мон 2</small></button>';
        }
        if (!hasAction) content += "<p>На этой местности пока нельзя строить.</p>";
      }

      element.innerHTML = content;
      element.querySelectorAll(".build-button").forEach(button => {
        button.onclick = () => {
          let result;
          if (button.dataset.action === "road") {
            result = C.infrastructure.buildRoad(selected.x, selected.y);
          } else {
            result = C.buildings.place(selected.x, selected.y, button.dataset.building, false);
          }
          if (!result.ok) this.addLog(result.message);
          this.refreshSelection();
          this.refreshResources();
          this.refreshWorkforce();
          this.refreshInfrastructure();
          this.refreshEconomy();
          this.draw();
        };
      });
    },

    addLog: function (message) {
      const element = $("eventLog");
      const item = document.createElement("div");
      item.className = "log-entry";
      const time = document.createElement("time");
      time.textContent = "День " + C.state.day;
      item.append(time, document.createTextNode(message));
      element.prepend(item);
      while (element.children.length > 12) element.lastElementChild.remove();
    }
  };
})();