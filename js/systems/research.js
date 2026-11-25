(function () {
  "use strict";
  const C = window.Civ;
  const catalog = [
    { id: "agriculture", name: "Совершенное земледелие", era: "Древний мир", branch: "food", tier: 0, cost: 25, materials: { wood: 8, food: 12 }, prerequisites: [], description: "Повышает производство еды фермами на 20%.", effect: "food" },
    { id: "pottery", name: "Гончарное дело", era: "Древний мир", branch: "food", tier: 1, cost: 35, materials: { wood: 12, stone: 5 }, prerequisites: ["agriculture"], description: "Увеличивает базовую вместимость хранилища на 100.", effect: "storage" },
    { id: "irrigation", name: "Оросительные каналы", era: "Древний мир", branch: "food", tier: 2, cost: 55, materials: { wood: 18, stone: 12 }, prerequisites: ["pottery"], description: "Дополнительно повышает производство еды на 15%.", effect: "irrigation" },

    { id: "masonry", name: "Каменная кладка", era: "Древний мир", branch: "industry", tier: 0, cost: 45, materials: { wood: 8, stone: 18 }, prerequisites: [], description: "Повышает добычу камня каменоломнями на 25%.", effect: "stone" },
    { id: "architecture", name: "Архитектура", era: "Древний мир", branch: "industry", tier: 1, cost: 70, materials: { wood: 22, stone: 25 }, prerequisites: ["masonry"], description: "Увеличивает вместимость складов ещё на 150.", effect: "storage_plus" },
    { id: "engineering", name: "Инженерное дело", era: "Древний мир", branch: "industry", tier: 2, cost: 105, materials: { wood: 35, stone: 45 }, prerequisites: ["architecture"], description: "Повышает эффективность добычи камня ещё на 20%.", effect: "engineering" },

    { id: "writing", name: "Письменность", era: "Древний мир", branch: "knowledge", tier: 0, cost: 75, materials: { wood: 15, food: 10 }, prerequisites: [], description: "Увеличивает ежедневное получение науки на 1 очко.", effect: "science" },
    { id: "mathematics", name: "Математика", era: "Древний мир", branch: "knowledge", tier: 1, cost: 90, materials: { wood: 18, stone: 10 }, prerequisites: ["writing"], description: "Даёт ещё 1 очко науки каждый день.", effect: "mathematics" },
    { id: "wheel", name: "Колесо", era: "Древний мир", branch: "knowledge", tier: 2, cost: 110, materials: { wood: 35, stone: 20 }, prerequisites: ["mathematics"], description: "Снижает ежедневное содержание дорог на 25%.", effect: "roads" }
  ];
  const branchNames = {
    food: "СЕЛЬСКОЕ ХОЗЯЙСТВО",
    industry: "СТРОИТЕЛЬСТВО И ПРОИЗВОДСТВО",
    knowledge: "ЗНАНИЯ И ИНЖЕНЕРИЯ"
  };

  C.research = {
    catalog: catalog,
    branchNames: branchNames,
    points: 0,
    activeId: null,
    progress: 0,
    completed: [],

    getTech: function (id) {
      return catalog.find(item => item.id === id) || null;
    },

    isCompleted: function (id) {
      return this.completed.includes(id);
    },

    missingPrerequisites: function (tech) {
      return (tech.prerequisites || []).filter(id => !this.isCompleted(id));
    },

    sciencePerDay: function () {
      return 1 + (this.isCompleted("writing") ? 1 : 0) +
        (this.isCompleted("mathematics") ? 1 : 0);
    },

    start: function (id) {
      const tech = this.getTech(id);
      if (!tech) return { ok: false, message: "Технология не найдена." };
      if (this.isCompleted(id)) return { ok: false, message: "Эта технология уже изучена." };
      if (this.activeId) return { ok: false, message: "Сначала заверши текущее исследование." };
      const missing = this.missingPrerequisites(tech);
      if (missing.length) {
        const names = missing.map(key => this.getTech(key).name).join(", ");
        return { ok: false, message: "Сначала изучи: " + names + "." };
      }
      const resources = C.state.resources;
      const materials = tech.materials || {};
      for (const key in materials) {
        if ((resources[key] || 0) < materials[key]) {
          const labels = { wood: "древесины", stone: "камня", food: "еды" };
          return { ok: false, message: "Недостаточно " + (labels[key] || key) + " для исследования «" + tech.name + "»." };
        }
      }
      for (const key in materials) resources[key] -= materials[key];
      this.activeId = id;
      this.progress = 0;
      C.emit("resources");
      C.emit("research");
      C.log("Начато исследование: " + tech.name + ". Материалы внесены.");
      return { ok: true, message: "Исследование начато." };
    },

    daily: function () {
      this.points = Math.round((this.points + this.sciencePerDay()) * 10) / 10;
      if (!this.activeId) {
        C.emit("research");
        return;
      }
      if (this.points < 1) {
        C.emit("research");
        return;
      }
      this.points = Math.round((this.points - 1) * 10) / 10;
      const tech = this.getTech(this.activeId);
      if (!tech) {
        this.activeId = null;
        this.progress = 0;
        C.emit("research");
        return;
      }
      this.progress = Math.min(tech.cost, this.progress + this.sciencePerDay());
      if (this.progress >= tech.cost) {
        this.completed.push(tech.id);
        this.activeId = null;
        this.progress = 0;
        C.log("Изучена технология: " + tech.name + ". " + tech.description);
      }
      C.emit("research");
    },

    getEffect: function (effect) {
      if (effect === "storage") {
        return (this.isCompleted("pottery") ? 100 : 0) +
          (this.isCompleted("architecture") ? 150 : 0);
      }
      return this.completed.reduce((value, id) => {
        const tech = this.getTech(id);
        if (!tech) return value;
        if (effect === "food" && tech.effect === "food") return value * 1.2;
        if (effect === "food" && tech.effect === "irrigation") return value * 1.15;
        if (effect === "stone" && tech.effect === "stone") return value * 1.25;
        if (effect === "stone" && tech.effect === "engineering") return value * 1.2;
        if (effect === "roads" && tech.effect === "roads") return value * 0.75;
        return value;
      }, 1);
    },

    exportData: function () {
      return {
        points: this.points,
        activeId: this.activeId,
        progress: this.progress,
        completed: this.completed.slice()
      };
    },

    importData: function (data) {
      if (!data || typeof data !== "object") return;
      this.points = Math.max(0, Number(data.points) || 0);
      this.completed = Array.isArray(data.completed)
        ? data.completed.filter(id => catalog.some(tech => tech.id === id))
        : [];
      this.activeId = catalog.some(tech => tech.id === data.activeId) &&
        !this.completed.includes(data.activeId) ? data.activeId : null;
      const active = this.getTech(this.activeId);
      this.progress = active ? Math.max(0, Math.min(active.cost, Number(data.progress) || 0)) : 0;
    }
  };
})();