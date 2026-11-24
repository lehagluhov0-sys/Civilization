(function () {
  "use strict";
  const C = window.Civ;
  const catalog = [
    { id: "agriculture", name: "Совершенное земледелие", era: "Древний мир", cost: 25, description: "Повышает производство еды фермами на 20%.", effect: "food" },
    { id: "pottery", name: "Гончарное дело", era: "Древний мир", cost: 35, description: "Увеличивает базовую вместимость хранилища на 100.", effect: "storage" },
    { id: "masonry", name: "Каменная кладка", era: "Древний мир", cost: 45, description: "Повышает добычу камня каменоломнями на 25%.", effect: "stone" },
    { id: "wheel", name: "Колесо", era: "Древний мир", cost: 60, description: "Снижает ежедневное содержание дорог на 25%.", effect: "roads" },
    { id: "writing", name: "Письменность", era: "Древний мир", cost: 75, description: "Увеличивает ежедневное получение науки на 1 очко.", effect: "science" }
  ];

  C.research = {
    catalog: catalog,
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

    sciencePerDay: function () {
      return 1 + (this.isCompleted("writing") ? 1 : 0);
    },

    start: function (id) {
      const tech = this.getTech(id);
      if (!tech) return { ok: false, message: "Технология не найдена." };
      if (this.isCompleted(id)) return { ok: false, message: "Эта технология уже изучена." };
      this.activeId = id;
      this.progress = 0;
      C.emit("research");
      C.log("Начато исследование: " + tech.name + ".");
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
      return this.completed.reduce((value, id) => {
        const tech = this.getTech(id);
        if (tech && tech.effect === effect) {
          if (effect === "food") return value * 1.2;
          if (effect === "stone") return value * 1.25;
          if (effect === "roads") return value * 0.75;
        }
        return value;
      }, effect === "storage" ? (this.isCompleted("pottery") ? 100 : 0) : 1);
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