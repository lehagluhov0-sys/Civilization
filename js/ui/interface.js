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
      C.on("citizens", () => this.refreshCitizens());
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
      C.on("construction", () => { if (this.constructionPanel) this.renderConstructionPanel(); });
      C.on("diplomacy", () => { if (this.diplomacyPanel) this.renderDiplomacyPanel(); });
      C.on("politics", () => { if (this.worldPanel) this.renderWorldPanel(); this.draw(); });
      C.on("trade", () => {
        if (this.diplomacyPanel) this.renderDiplomacyPanel();
        if (this.worldPanel) this.renderWorldPanel();
        this.draw();
      });
      C.on("worldEvents", () => { if (this.worldPanel) this.renderWorldPanel(); });

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
      $("politicalLayerToggle").onchange = event => {
        C.state.showPoliticalMap = event.target.checked;
        C.emit("settings");
        this.draw();
      };
      $("countryBordersToggle").onchange = event => {
        C.state.showCountryBorders = event.target.checked;
        C.emit("settings");
        this.draw();
      };
      $("tradeRoutesToggle").onchange = event => {
        C.state.showTradeRoutes = event.target.checked;
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
          if (section !== "construction") this.closeConstructionPanel();
          if (section === "city") {
            this.closeResearchPanel();
            this.closeDiplomacyPanel();
            this.closeWorldPanel();
            this.addLog("Выбран раздел управления поселением.");
            if (C.city.center) C.state.selected = { x: C.city.center.x, y: C.city.center.y };
            C.emit("selection");
            this.draw();
          } else if (section === "map") {
            this.closeResearchPanel();
            this.closeDiplomacyPanel();
            this.closeWorldPanel();
            this.addLog("Открыта карта мира.");
          } else if (section === "construction") {
            this.closeResearchPanel(); this.closeDiplomacyPanel(); this.closeWorldPanel();
            this.openConstructionPanel();
          } else if (section === "research") {
            this.closeDiplomacyPanel();
            this.closeWorldPanel();
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
      $("menuButton").onclick = () => this.openMainMenu(false);
    },




    openMainMenu: function (isStart) {
      const old = document.getElementById("mainMenuOverlay");
      if (old) old.remove();
      const overlay = document.createElement("div");
      overlay.id = "mainMenuOverlay";
      overlay.className = "main-menu-overlay";
      overlay.innerHTML =
        '<div class="main-menu-card">' +
          '<div class="main-menu-emblem">C</div>' +
          '<div class="main-menu-kicker">СТРАТЕГИЯ · ИСТОРИЯ · РАЗВИТИЕ</div>' +
          '<h1>CIVILIZATION</h1><p class="main-menu-subtitle">Твоя история начинается с одного поселения</p>' +
          '<div class="main-menu-actions">' +
            '<button id="menuContinue" class="main-menu-primary">Продолжить</button>' +
            '<button id="menuNewGame">Новая игра</button>' +
            '<button id="menuLoad">Загрузить сохранение</button>' +
            '<button id="menuSave">Сохранить игру</button>' +
            '<button id="menuSettings">Настройки карты</button>' +
          '</div>' +
          '<div class="main-menu-version">OFFLINE STRATEGY · v0.21.0</div>' +
        '</div>';
      document.body.appendChild(overlay);
      overlay.querySelector("#menuContinue").onclick = () => overlay.remove();
      overlay.querySelector("#menuNewGame").onclick = () => {
        const previous = document.getElementById("newGameConfirmOverlay");
        if (previous) previous.remove();
        const confirmLayer = document.createElement("div");
        confirmLayer.id = "newGameConfirmOverlay";
        confirmLayer.style.cssText = "position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(3,6,10,.88);";
        confirmLayer.innerHTML =
          '<div role="dialog" aria-modal="true" aria-labelledby="newGameConfirmTitle" ' +
          'style="width:min(420px,100%);box-sizing:border-box;padding:22px;border:1px solid #c69b55;border-radius:14px;background:#1b242d;color:#e8edf1;box-shadow:0 18px 60px #000b;text-align:center">' +
            '<div style="font-size:28px;margin-bottom:8px">⚠</div>' +
            '<h2 id="newGameConfirmTitle" style="font-size:19px;margin:0 0 12px">Начать новую игру?</h2>' +
            '<p style="font-size:13px;line-height:1.55;color:#b8c3cb;margin:0 0 20px">Текущее автосохранение будет заменено. Ручные сохранения в слотах останутся.</p>' +
            '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
              '<button id="cancelNewGame" type="button" style="min-height:44px;flex:1;min-width:120px;padding:10px 14px;border:1px solid #596875;border-radius:8px;background:#293642;color:#e8edf1;font-weight:700">Отмена</button>' +
              '<button id="confirmNewGame" type="button" style="min-height:44px;flex:1;min-width:120px;padding:10px 14px;border:1px solid #c69b55;border-radius:8px;background:#8b6330;color:#fff;font-weight:700">Начать</button>' +
            '</div>' +
          '</div>';
        document.body.appendChild(confirmLayer);
        confirmLayer.querySelector("#cancelNewGame").onclick = () => confirmLayer.remove();
        confirmLayer.querySelector("#confirmNewGame").onclick = () => {
          localStorage.removeItem("civilization_save_v1");
          sessionStorage.setItem("civilization_start_new_game", "1");
          window.location.reload();
        };
      };
      overlay.querySelector("#menuLoad").onclick = () => this.openSaveSlots("load");
      overlay.querySelector("#menuSave").onclick = () => this.openSaveSlots("save");
      overlay.querySelector("#menuSettings").onclick = () => {
        const political = !C.state.showPoliticalMap;
        C.state.showPoliticalMap = political;
        C.emit("settings");
        this.draw();
        this.addLog(political ? "Политическая карта включена." : "Политическая карта выключена.");
      };
      if (isStart) overlay.querySelector("#menuContinue").textContent = "Начать игру";
    },

    openSaveSlots: function (mode) {
      const existing = document.getElementById("saveSlotsOverlay");
      if (existing) existing.remove();
      const overlay = document.createElement("div");
      overlay.id = "saveSlotsOverlay";
      overlay.className = "save-slots-overlay";
      overlay.innerHTML = '<div class="save-slots-card"><div class="save-slots-heading"><b>' +
        (mode === "save" ? "СОХРАНЕНИЕ ИГРЫ" : "ЗАГРУЗКА ИГРЫ") +
        '</b><button id="closeSaveSlots">Закрыть ✕</button></div><div id="saveSlotsList"></div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector("#closeSaveSlots").onclick = () => overlay.remove();
      const list = overlay.querySelector("#saveSlotsList");
      C.save.listSlots().forEach(slot => {
        const item = document.createElement("div");
        item.className = "save-slot";
        const date = slot.savedAt ? new Date(slot.savedAt).toLocaleString("ru-RU") : "Пустой слот";
        item.innerHTML = '<div><b>Слот ' + slot.id + '</b><small>' +
          (slot.empty ? "Пусто" : date + " · День " + slot.day + " · Год " + slot.year + " · Жители " + slot.population) +
          '</small></div><div class="save-slot-actions">' +
          '<button data-slot-action="main">' + (mode === "save" ? "Сохранить" : "Загрузить") + '</button>' +
          (slot.empty ? '' : '<button data-slot-action="delete">Удалить</button>') +
          '</div>';
        item.querySelector('[data-slot-action="main"]').onclick = () => {
          if (mode === "save") {
            const ok = C.save.save(slot.id);
            this.addLog(ok ? "Игра сохранена в слот " + slot.id + "." : "Не удалось сохранить игру.");
            overlay.remove();
            return;
          }
          if (!slot.empty && C.save.load(slot.id)) {
            if (C.city) C.city.recalculate();
            if (C.infrastructure) C.infrastructure.updateNetwork();
            if (C.politics) C.politics.recalculateTerritories();
            C.camera.ready = true;
            C.camera.resize();
            this.refresh();
            overlay.remove();
            const menu = document.getElementById("mainMenuOverlay");
            if (menu) menu.remove();
            this.addLog("Загружен слот " + slot.id + ".");
          } else {
            this.addLog("Не удалось загрузить слот " + slot.id + ".");
          }
        };
        const del = item.querySelector('[data-slot-action="delete"]');
        if (del) del.onclick = () => {
          C.save.deleteSlot(slot.id);
          this.openSaveSlots(mode);
        };
        list.appendChild(item);
      });
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
      let html = '<p style="font-size:12px;color:#9eacb8">Государства развиваются самостоятельно. Границы учитывают столицы и основанные города.</p>';
      if (C.worldEvents && C.worldEvents.active.length) {
        html += '<div style="border:1px solid #c69b55;padding:9px;margin:8px 0"><b>МИРОВЫЕ СОБЫТИЯ</b>';
        C.worldEvents.active.forEach(event => {
          html += '<p style="font-size:11px;margin:5px 0"><b>' + event.name + '</b> · ещё ' + event.remaining + ' дн.<br><span style="color:#aebbc5">' + event.description + '</span></p>';
        });
        html += '</div>';
      }
      if (C.trade && C.trade.routes.length) {
        html += '<div style="background:#26333e;padding:9px;margin:8px 0"><b>ТОРГОВЛЯ</b>';
        C.trade.routes.forEach(route => {
          const civ = C.diplomacy.get(route.civId);
          html += '<div style="font-size:11px;margin-top:5px">' + (civ ? civ.flag + " " + civ.name : route.civId) + ' · ' + route.length + ' клеток · ' + route.transport + ' · ' + (route.active ? 'активен' : 'приостановлен') + '</div>';
        });
        html += '</div>';
      }
      html += '<div style="background:#26333e;padding:10px;margin:8px 0"><b>ТВОЁ ГОСУДАРСТВО</b><div style="font-size:12px;margin-top:5px">Территория: ' + (C.politics.playerTerritory || 0) + ' клеток · Население: ' + C.city.population + ' · Столица: ' + (C.city.center.x + 1) + ', ' + (C.city.center.y + 1) + '</div></div>';
      C.politics.countries.forEach(c => {
        const relation = C.diplomacy.get(c.id);
        html += '<div style="background:#222e39;border-left:4px solid ' + c.color + ';padding:10px;margin:8px 0">';
        html += '<div style="display:flex;justify-content:space-between;gap:8px"><b>' + c.flag + ' ' + c.name + '</b><span style="color:#d9b66f;font-size:11px">' + (relation ? C.diplomacy.relationName(relation.relation) : "Нейтралитет") + '</span></div>';
        html += '<div style="font-size:11px;color:#aebbc5;margin-top:5px">' + c.leader + ' · Столица: ' + (c.capital.x + 1) + ', ' + (c.capital.y + 1) + '</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:8px;font-size:11px"><span>Жители<br><b>' + c.population.toLocaleString("ru-RU") + '</b></span><span>Города<br><b>' + c.cities + '</b></span><span>Земли<br><b>' + c.territory + '</b></span><span>Развитие<br><b>' + c.development + '/10</b></span></div>';
        html += '<div style="height:5px;background:#111920;margin-top:8px"><div style="height:5px;width:' + c.stability + '%;background:' + c.color + '"></div></div><small style="color:#9eacb8">Стабильность ' + c.stability + '% · Казна ' + Math.floor(c.treasury) + '</small><div style="font-size:10px;color:#aebbc5;margin-top:5px">Города: ' + (c.cityNames || []).join(', ') + '</div></div>';
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
        if (C.trade && civ.trade) {
          const route = C.trade.get(civ.id);
          if (route) {
            html += '<p style="font-size:10px;color:#d7b46b">Маршрут: ' + route.length + ' клеток · ' + (route.active ? 'активен' : 'приостановлен') + '</p>';
            html += '<button class="wide-button" data-trade-close="' + civ.id + '" style="font-size:10px;padding:7px">Закрыть маршрут</button>';
          } else {
            html += '<button class="wide-button" data-trade-route="' + civ.id + '" style="font-size:10px;padding:7px">Прокладывать торговый маршрут</button>';
          }
        }
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

      if (C.trade) {
        html += '<div style="border:1px solid #c69b55;padding:10px;margin:10px 0"><b>ТОРГОВЫЕ МАРШРУТЫ</b>';
        C.trade.routes.forEach(route => {
          const civ = d.get(route.civId);
          html += '<p style="font-size:11px;color:#c8d3db">' + (civ ? civ.flag + " " + civ.name : route.civId) +
            ' · ' + route.length + ' клеток · ' + route.transport + ' · ' + (route.active ? 'работает' : 'приостановлен') + '</p>';
        });
        if (!C.trade.routes.length) html += '<p style="font-size:11px;color:#9eacb8">Маршрутов пока нет. Заключи торговый договор, затем проложи путь до столицы партнёра.</p>';
        html += '</div>';
      }

      content.innerHTML = html;
      content.querySelectorAll("[data-dip-action]").forEach(button => {
        button.onclick = () => {
          const result = C.diplomacy.action(button.dataset.civ, button.dataset.dipAction);
          if (!result.ok) this.addLog(result.message);
          this.renderDiplomacyPanel();
          this.refreshResources();
        };
      });
      content.querySelectorAll("[data-trade-route]").forEach(button => {
        button.onclick = () => {
          const result = C.trade.createRoute(button.dataset.tradeRoute);
          if (!result.ok) this.addLog(result.message);
          this.renderDiplomacyPanel();
          this.refreshResources();
          this.draw();
        };
      });
      content.querySelectorAll("[data-trade-close]").forEach(button => {
        button.onclick = () => {
          C.trade.closeRoute(button.dataset.tradeClose);
          this.renderDiplomacyPanel();
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
        panel.innerHTML = '<div style="width:min(980px,100%);max-height:92%;overflow:auto;background:#1b242d;border:1px solid #c69b55;padding:16px;color:#e8edf1;box-shadow:0 12px 40px #0009"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px"><b style="letter-spacing:2px">НАУЧНЫЕ ИССЛЕДОВАНИЯ</b><button id="closeResearch" class="wide-button" style="width:auto">Закрыть ✕</button></div><div id="researchContent"></div></div>';
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
      let html = '<p style="color:#91a0ad;font-size:12px">Наука: <b style="color:#e0b86e">' +
        C.research.points.toFixed(1) + '</b> · +' + C.research.sciencePerDay() + ' очко/день</p>';
      if (active) {
        const percent = Math.min(100, Math.round(C.research.progress / active.cost * 100));
        html += '<div style="padding:10px;background:#222e39;border:1px solid #c69b55;margin:10px 0;border-radius:8px"><b>Исследуется: ' +
          active.name + '</b><p style="font-size:11px;color:#91a0ad">' + Math.round(C.research.progress) + ' / ' + active.cost +
          ' науки · ' + percent + '%</p><div style="height:8px;background:#11171d;border-radius:8px;overflow:hidden"><div style="height:8px;width:' +
          percent + '%;background:#c69b55"></div></div></div>';
      }
      html += '<p style="font-size:11px;color:#aab6bf">Технологии связаны в ветви. Обычные открытия требуют только науку; материалы нужны лишь для практических усовершенствований.</p>';
      html += '<div class="technology-tree" style="display:flex;flex-direction:column;gap:14px;overflow-x:auto;padding:4px 2px 12px">';
      ["food","industry","knowledge"].forEach(branch => {
        html += '<section style="min-width:760px;background:#151e26;border:1px solid #34424e;border-radius:9px;padding:10px">';
        html += '<div style="font-size:11px;letter-spacing:1px;color:#d9b66f;margin-bottom:9px">' + C.research.branchNames[branch] + '</div>';
        html += '<div style="display:grid;grid-template-columns:repeat(4,minmax(155px,1fr));gap:15px;align-items:stretch">';
        const techs = C.research.catalog.filter(tech => tech.branch === branch).sort((a,b) => a.tier-b.tier);
        techs.forEach((tech,index) => {
          const done=C.research.isCompleted(tech.id),selected=C.research.activeId===tech.id;
          const missing=C.research.missingPrerequisites(tech),locked=missing.length>0;
          const mats=Object.entries(tech.materials||{}).map(([key,value])=>{
            const label={wood:"Дерево",stone:"Камень"}[key]||key;
            const enough=(C.state.resources[key]||0)>=value;
            return '<span style="color:'+(enough?'#9ac58a':'#e18a79')+'">'+label+': '+value+'</span>';
          }).join('<br>');
          const border=done?'#79a56a':selected?'#c69b55':locked?'#39434b':'#55758b';
          html += '<article style="position:relative;display:flex;flex-direction:column;padding:10px;background:#222e39;border:1px solid '+border+';border-radius:8px;opacity:'+(locked?'.68':'1')+';min-height:174px">';
          html += '<div style="font-size:9px;color:#91a0ad">УРОВЕНЬ '+(index+1)+'</div><b style="font-size:12px;margin:5px 0">'+tech.name+'</b>';
          html += '<p style="font-size:10px;line-height:1.4;color:#aab6bf;flex:1">'+tech.description+'</p>';
          html += '<div style="font-size:10px;color:#e0b86e;margin:5px 0">'+tech.cost+' науки</div>';
          if(mats) html += '<div style="font-size:10px;line-height:1.5;margin-bottom:7px">'+mats+'</div>';
          if(done) html += '<b style="font-size:9px;color:#91c47d">✓ ИЗУЧЕНО</b>';
          else if(selected) html += '<b style="font-size:9px;color:#e0b86e">● ИССЛЕДУЕТСЯ</b>';
          else if(locked) html += '<small style="color:#e0a47a">После: '+missing.map(id=>C.research.getTech(id).name).join(", ")+'</small>';
          else html += '<button class="wide-button" data-tech="'+tech.id+'" '+(C.research.activeId?'disabled':'')+'>Изучить</button>';
          html += '</article>';
        });
        html += '</div><div style="font-size:10px;color:#8295a3;margin-top:7px;text-align:center">Узлы соединены слева направо: следующий уровень открывается после предыдущего</div></section>';
      });
      html += '</div>';
      content.innerHTML=html;
      content.querySelectorAll("[data-tech]").forEach(button=>{
        button.onclick=()=>{
          const result=C.research.start(button.dataset.tech);
          if(!result.ok)this.addLog(result.message);
          this.renderResearchPanel();this.refreshResources();
        };
      });
    },

    openConstructionPanel: function () {
      if(!this.constructionPanel){
        const panel=document.createElement("div");
        panel.id="constructionOverlay";
        panel.style.cssText="position:fixed;inset:0;z-index:510;background:rgba(5,9,13,.9);display:flex;align-items:center;justify-content:center;padding:12px";
        panel.innerHTML='<div style="width:min(900px,100%);max-height:94%;overflow:auto;background:#1b242d;border:1px solid #c69b55;padding:14px;color:#e8edf1"><div style="display:flex;justify-content:space-between;align-items:center"><b>ЦЕНТР СТРОИТЕЛЬСТВА</b><button id="closeConstruction" class="wide-button" style="width:auto">Закрыть ✕</button></div><div id="constructionContent"></div></div>';
        document.body.appendChild(panel);this.constructionPanel=panel;
        panel.querySelector("#closeConstruction").onclick=()=>this.closeConstructionPanel();
      }
      this.renderConstructionPanel();
    },

    closeConstructionPanel: function () {
      if(this.constructionPanel)this.constructionPanel.remove();
      this.constructionPanel=null;
    },

    renderConstructionPanel: function () {
      if(!this.constructionPanel||!C.citizens)return;
      const content=this.constructionPanel.querySelector("#constructionContent");
      const selected=C.state.selected?C.world.get(C.state.selected.x,C.state.selected.y):null;
      let html='<p style="font-size:11px;color:#aab6bf">Выдавай ИИ строительные заказы. Он сам найдёт подходящий участок, дождётся материалов и направит строителей.</p>';
      html+='<div style="padding:10px;background:#222e39;border-radius:8px;margin:10px 0"><b>ОЧЕРЕДЬ ЗАКАЗОВ · '+C.citizens.orders.length+'</b>';
      if(!C.citizens.orders.length)html+='<p style="font-size:10px;color:#91a0ad">Очередь пока пуста.</p>';
      C.citizens.orders.forEach((order,i)=>{
        const name=order.kind==="upgrade"?"Улучшение здания ("+(order.x+1)+", "+(order.y+1)+")":(C.buildings.catalog[order.type]?.name||order.type);
        html+='<div style="font-size:11px;padding:6px 0;border-top:1px solid #34424e">'+(i+1)+'. '+name+'</div>';
      });
      if(C.citizens.activeSite()){const site=C.citizens.activeSite();const tile=C.world.get(site.x,site.y);html+='<div style="font-size:10px;color:#e0b86e">В работе: '+(C.buildings.catalog[site.type]?.name||site.type)+(site.upgrade?' · улучшение':'')+' · '+Math.round(tile.construction.progress/tile.construction.required*100)+'%</div>';}
      html+='</div><b>НОВОЕ СТРОИТЕЛЬСТВО</b><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:7px;margin:8px 0">';
      Object.keys(C.buildings.catalog).forEach(type=>{
        if(type==="city_center")return;
        const def=C.buildings.catalog[type];
        const locked=def.requiresResearch&&(!C.research||!C.research.isCompleted(def.requiresResearch));
        const costs=Object.entries(def.cost||{}).map(([key,value])=>({wood:"Д",stone:"К",money:"₵"}[key]||key)+":"+value).join(" · ");
        html+='<button class="wide-button" data-order-building="'+type+'" '+(locked?'disabled':'')+' style="margin:0;min-height:62px"><b>'+def.name+'</b><small class="build-cost">'+costs+'</small>'+(locked?'<small class="build-cost">Требуется исследование</small>':'')+'</button>';
      });
      html+='</div><b>УЛУЧШЕНИЕ ЗДАНИЯ</b>';
      if(selected&&selected.building&&selected.building.type!=="city_center"){
        const level=Math.max(1,Number(selected.building.level)||1);
        html+='<p style="font-size:11px;color:#aab6bf">'+C.buildings.catalog[selected.building.type].name+' · уровень '+level+'/3 · следующий уровень: дерево '+(12*level)+', камень '+(8*level)+'</p>';
        html+='<button class="wide-button" id="orderUpgrade" '+(level>=3?'disabled':'')+'>Заказать улучшение выбранного здания</button>';
      }else html+='<p style="font-size:10px;color:#91a0ad">Выбери здание на карте, затем открой этот раздел.</p>';
      content.innerHTML=html;
      content.querySelectorAll("[data-order-building]").forEach(button=>button.onclick=()=>{
        const result=C.citizens.requestBuilding(button.dataset.orderBuilding);if(!result.ok)this.addLog(result.message);
        this.renderConstructionPanel();
      });
      const upgrade=content.querySelector("#orderUpgrade");
      if(upgrade)upgrade.onclick=()=>{
        const result=C.citizens.requestUpgrade(C.state.selected.x,C.state.selected.y);if(!result.ok)this.addLog(result.message);
        this.renderConstructionPanel();
      };
    },

    draw: function () {
      C.world.draw(this.ctx);
      C.world.drawMini(this.mini);
      this.refreshZoom();
    },

    refresh: function () {
      const mapSize = $("mapSize");
      if (mapSize) mapSize.textContent = C.world.width + " × " + C.world.height;
      this.refreshResources();
      this.refreshEconomy();
      this.refreshWorkforce();
      this.refreshCitizens();
      this.refreshInfrastructure();
      $("season").textContent = C.time.season();
      $("day").textContent = C.state.day;
      this.refreshTime();
      this.refreshRoadMode();
      $("politicalLayerToggle").checked = !!C.state.showPoliticalMap;
      $("countryBordersToggle").checked = C.state.showCountryBorders !== false;
      $("tradeRoutesToggle").checked = !!C.state.showTradeRoutes;
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
      if ($("iron")) $("iron").textContent = resources.iron || 0;
      if ($("copper")) $("copper").textContent = resources.copper || 0;
      $("storageCapacity").textContent = C.infrastructure.storageCapacity();
    },

    refreshWorkforce: function () {
      const workforce = C.workforce;
      $("laborForce").textContent = workforce.laborForce;
      $("employed").textContent = workforce.employed;
      $("unemployed").textContent = workforce.unemployed;
      $("vacantJobs").textContent = workforce.vacantJobs;
      $("farmWorkers").textContent = workforce.workersByType.farm || 0;
      $("fisheryWorkers").textContent = workforce.workersByType.fishery || 0;
      $("marketWorkers").textContent = workforce.workersByType.market || 0;
      $("lumberWorkers").textContent = workforce.workersByType.lumber || 0;
      $("quarryWorkers").textContent = workforce.workersByType.quarry || 0;
      $("warehouseWorkers").textContent = workforce.workersByType.warehouse || 0;
    },

    refreshCitizens: function () {
      if (!C.citizens) return;
      const agents = C.citizens.agents || [];
      const builders = agents.filter(agent => agent.role === "builder").length;
      const site = C.citizens.activeSite();
      $("citizenCount").textContent = agents.length;
      $("builderCount").textContent = builders;
      if (!site) {
        $("constructionStatus").textContent = "Нет";
      } else {
        const tile = C.world.get(site.x, site.y);
        const build = tile && tile.construction;
        const percent = build ? Math.round(build.progress / build.required * 100) : 0;
        const definition = C.buildings.catalog[site.type];
        $("constructionStatus").textContent = (definition ? definition.name : site.type) + " · " + percent + "%";
      }
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
      $("taxIncome").textContent = economy.taxIncome.toFixed(1);
      if ($("totalIncome")) $("totalIncome").textContent = economy.income.toFixed(1);
      $("buildingUpkeep").textContent = economy.buildingUpkeep.toFixed(1);
      $("roadUpkeep").textContent = economy.roadUpkeep.toFixed(2);
      $("wageCost").textContent = economy.wages.toFixed(2);
      if ($("marketIncome")) $("marketIncome").textContent = economy.commerceIncome.toFixed(2);
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
        : "ПЕРЕТАСКИВАЙ КАРТУ · НАЖМИ НА МЕСТНОСТЬ ИЛИ ОБЪЕКТ ДЛЯ ОСМОТРА";
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
        element.innerHTML = '<div class="empty-symbol">⌖</div><b>Ничего не выбрано</b><p>Выбери участок или объект, чтобы посмотреть сведения.</p>';
        return;
      }

      const tile = C.world.get(selected.x, selected.y);
      if (!tile) {
        element.textContent = "Неизвестная клетка";
        return;
      }

      const terrainInfo = C.terrain ? C.terrain.getInfo(tile.type) : null;
      let content =
        '<div class="terrain-preview" style="background:' + C.world.colors[tile.type] + '"></div>' +
        '<div class="terrain-name">' + C.world.names[tile.type] + '</div>' +
        '<div class="terrain-description">' + C.world.descriptions[tile.type] + '</div>' +
        (terrainInfo ? '<p style="font-size:10px;color:#d7b46b">Плодородие: ' + C.terrain.fertility(tile) + '% · ' + terrainInfo.note + '</p>' : '') +
        (tile.deposit ? '<p style="font-size:10px;color:#d7b46b">Месторождение: ' + ({stone:"строительный камень",iron:"железо",copper:"медь"}[tile.deposit]||tile.deposit) + '</p>' : '') +
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
          if (C.terrain ? !C.terrain.canBuild(definition, tile.x, tile.y) : !definition.terrain.includes(tile.type)) return;
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
          const roadCost = C.terrain ? C.terrain.roadCost(tile) : { wood: 3, money: 2 };
          content += '<button class="wide-button build-button road-button" data-action="road">Проложить дорогу' +
            '<small class="build-cost">Д ' + roadCost.wood + ' · Мон ' + roadCost.money + '</small></button>';
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
      while (element.children.length > 40) element.lastElementChild.remove();
    }
  };
})();