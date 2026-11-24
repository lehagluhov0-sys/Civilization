(function () {
  "use strict";
  const C = window.Civ;
  const $ = id => document.getElementById(id);

  C.ui = {
    init: function () {
      this.canvas = $("worldCanvas");
      this.ctx = this.canvas.getContext("2d");
      this.mini = $("miniMap").getContext("2d");
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

      this.refresh();
    },

    bind: function () {
      const canvas = this.canvas;
      let pointer = null;

      canvas.addEventListener("pointerdown", event => {
        const rect = canvas.getBoundingClientRect();
        pointer = {
          startX: event.clientX - rect.left,
          startY: event.clientY - rect.top,
          lastX: event.clientX - rect.left,
          lastY: event.clientY - rect.top,
          moved: false
        };
        canvas.setPointerCapture(event.pointerId);
      });

      canvas.addEventListener("pointermove", event => {
        if (!pointer) return;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const dx = x - pointer.lastX;
        const dy = y - pointer.lastY;

        if (Math.hypot(x - pointer.startX, y - pointer.startY) > 5) pointer.moved = true;
        if (pointer.moved) {
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
        if (!pointer.moved) {
          const tile = C.camera.screenToTile(x, y);
          if (C.world.get(tile.x, tile.y)) {
            C.state.selected = tile;
            C.emit("selection");
            this.draw();
          }
        }
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
        this.draw();
      };
      $("clearSelectionButton").onclick = () => {
        C.state.selected = null;
        C.emit("selection");
        this.draw();
      };
      $("gridToggle").onchange = event => {
        C.state.showGrid = event.target.checked;
        this.draw();
      };
      $("pauseButton").onclick = () => {
        C.state.paused = !C.state.paused;
        this.refreshTime();
      };

      document.querySelectorAll(".speed-button").forEach(button => {
        button.onclick = () => {
          C.state.speed = Number(button.dataset.speed);
          C.state.paused = false;
          this.refreshTime();
        };
      });

      document.querySelectorAll(".nav-button").forEach(button => {
        button.onclick = () => {
          document.querySelectorAll(".nav-button").forEach(item => {
            item.classList.toggle("active", item === button);
          });
          if (button.dataset.section === "city") {
            this.addLog("Выбран раздел управления поселением.");
            if (C.city.center) C.state.selected = { x: C.city.center.x, y: C.city.center.y };
            C.emit("selection");
            this.draw();
          } else if (button.dataset.section !== "map") {
            this.addLog("Раздел «" + button.textContent.trim() + "» будет добавлен на следующем этапе.");
          }
        };
      });

      $("taxRate").oninput = event => {
        C.economy.setTaxRate(event.target.value);
        this.refreshEconomy();
      };
      $("menuButton").onclick = () => this.addLog("Главное меню будет добавлено позже.");
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
      this.refreshSelection();
      this.draw();
    },

    refreshResources: function () {
      const resources = C.state.resources;
      $("population").textContent = C.city.population;
      $("cityPopulation").textContent = C.city.population;
      $("cityHousing").textContent = C.city.housing;
      $("cityJobs").textContent = C.city.employment + "/" + C.city.maxJobs;
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