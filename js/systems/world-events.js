(function () {
  "use strict";
  const C = window.Civ;
  const catalog = [
    { id: "good_harvest", name: "Богатый урожай", description: "Благоприятная погода повысила сбор продовольствия.", days: 6, modifiers: { food: 1.3 } },
    { id: "market_fair", name: "Большая ярмарка", description: "Поток торговцев временно увеличил налоговые поступления.", days: 5, modifiers: { tax: 1.25 } },
    { id: "dry_spell", name: "Засушливый период", description: "Недостаток влаги снизил урожайность ферм.", days: 5, modifiers: { food: 0.72 } },
    { id: "craftsmen", name: "Съезд мастеров", description: "Ремесленники приехали в поселение и оживили рынок.", days: 5, modifiers: { tax: 1.12 } },
    { id: "mild_winter", name: "Мягкая зима", description: "Тёплая погода смягчила зимнее падение урожая.", days: 6, modifiers: { food: 1.18 } }
  ];

  C.worldEvents = {
    catalog: catalog,
    active: [],
    history: [],
    dayCounter: 0,

    getModifier: function (key) {
      return this.active.reduce((value, event) => value * (event.modifiers[key] || 1), 1);
    },

    start: function (id) {
      const definition = catalog.find(event => event.id === id);
      if (!definition || this.active.some(event => event.id === id)) return false;
      const event = {
        id: definition.id, name: definition.name, description: definition.description,
        remaining: definition.days, modifiers: Object.assign({}, definition.modifiers)
      };
      this.active.push(event);
      this.history.unshift({ day: C.state.day, name: event.name });
      this.history = this.history.slice(0, 12);
      C.log("Событие: " + event.name + ". " + event.description);
      C.emit("worldEvents");
      return true;
    },

    daily: function () {
      this.dayCounter++;
      this.active.forEach(event => event.remaining--);
      const expired = this.active.filter(event => event.remaining <= 0);
      this.active = this.active.filter(event => event.remaining > 0);
      expired.forEach(event => C.log("Завершилось событие «" + event.name + "»."));
      if (this.dayCounter % 12 === 0 && this.active.length === 0 && Math.random() < 0.6) {
        const options = catalog.filter(event => !this.history.slice(0, 2).some(old => old.name === event.name));
        if (options.length) this.start(options[Math.floor(Math.random() * options.length)].id);
      }
      if (expired.length || this.dayCounter % 5 === 0) C.emit("worldEvents");
    },

    exportData: function () {
      return {
        dayCounter: this.dayCounter,
        active: this.active.map(event => ({
          id: event.id, remaining: event.remaining
        })),
        history: this.history.slice(0, 12)
      };
    },

    importData: function (data) {
      if (!data || typeof data !== "object") return;
      this.dayCounter = Math.max(0, Number(data.dayCounter) || 0);
      this.active = (Array.isArray(data.active) ? data.active : []).slice(0, 2).map(saved => {
        const definition = catalog.find(event => event.id === saved.id);
        if (!definition) return null;
        return {
          id: definition.id, name: definition.name, description: definition.description,
          remaining: Math.max(1, Math.min(definition.days, Number(saved.remaining) || 1)),
          modifiers: Object.assign({}, definition.modifiers)
        };
      }).filter(Boolean);
      this.history = Array.isArray(data.history) ? data.history.slice(0, 12) : [];
    }
  };
})();