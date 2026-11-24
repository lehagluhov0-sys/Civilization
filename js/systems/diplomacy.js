(function () {
  "use strict";
  const C = window.Civ;
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const catalog = [
    { id: "solaria", name: "Солария", flag: "☀️", leader: "Королева Элиана", trait: "Торговцы", style: "Любят торговлю и ценят надёжных партнёров.", focus: "food", bonus: "Еда" },
    { id: "northland", name: "Нордхейм", flag: "❄️", leader: "Ярл Эйрик", trait: "Осторожные", style: "Сдержанны, но уважают силу и последовательность.", focus: "wood", bonus: "Дерево" },
    { id: "verdantia", name: "Вердантия", flag: "🌿", leader: "Советница Мира", trait: "Учёные", style: "Заинтересованы в знаниях и культурном обмене.", focus: "science", bonus: "Наука" },
    { id: "montara", name: "Монтара", flag: "⛰️", leader: "Князь Дарен", trait: "Промышленники", style: "Ценят ресурсы, ремесло и взаимную выгоду.", focus: "stone", bonus: "Камень" },
    { id: "maritoria", name: "Маритория", flag: "⚓", leader: "Дож Леон", trait: "Дипломаты", style: "Предпочитают договоры, посольства и долгий мир.", focus: "money", bonus: "Монеты" }
  ];
  const fresh = () => catalog.map((c, i) => ({
    id: c.id, name: c.name, flag: c.flag, leader: c.leader, trait: c.trait,
    style: c.style, focus: c.focus, relation: [12, -4, 20, 5, 15][i],
    trust: [25, 18, 30, 22, 28][i], embassy: false, trade: false,
    nonAggression: 0, alliance: false, cooldown: 0, lastAction: "Пока контактов не было."
  }));
  C.diplomacy = {
    civilizations: fresh(),
    reputation: 50,
    influence: 10,
    envoys: 2,
    pending: [],
    history: [],
    dayCounter: 0,

    get: function (id) { return this.civilizations.find(c => c.id === id) || null; },
    relationName: function (value) {
      if (value >= 75) return "Дружба";
      if (value >= 45) return "Хорошие отношения";
      if (value >= 15) return "Нейтралитет";
      if (value >= -15) return "Холодный нейтралитет";
      if (value >= -45) return "Напряжённость";
      return "Враждебность";
    },
    record: function (message) {
      this.history.unshift({ day: C.state.day, message: message });
      if (this.history.length > 30) this.history.length = 30;
      C.log(message);
      C.emit("diplomacy");
    },
    adjust: function (civ, amount, trust) {
      civ.relation = clamp(civ.relation + amount, -100, 100);
      if (trust) civ.trust = clamp(civ.trust + trust, 0, 100);
    },
    action: function (id, action) {
      const civ = this.get(id);
      if (!civ) return { ok: false, message: "Цивилизация не найдена." };
      if (civ.cooldown > 0) return { ok: false, message: "Нужно подождать ещё " + civ.cooldown + " дн. перед новым дипломатическим действием." };
      const r = C.state.resources;
      const pay = (money, wood, stone) => {
        if (r.money < money || r.wood < wood || r.stone < stone) return false;
        r.money -= money; r.wood -= wood; r.stone -= stone; return true;
      };
      let message = "";
      if (action === "greet") {
        this.adjust(civ, 3, 2); civ.cooldown = 3;
        message = "Посольство установило дружеский контакт с державой «" + civ.name + "».";
      } else if (action === "embassy") {
        if (civ.embassy) return { ok: false, message: "Посольство уже открыто." };
        if (!pay(25, 0, 5)) return { ok: false, message: "Нужно 25 монет и 5 камня." };
        civ.embassy = true; this.adjust(civ, 8, 8); civ.cooldown = 8;
        message = "В столице «" + civ.name + "» открыто наше постоянное посольство.";
      } else if (action === "gift") {
        if (!pay(20, 0, 0)) return { ok: false, message: "Для подарка нужно 20 монет." };
        this.adjust(civ, 7, 5); this.reputation = clamp(this.reputation + 1, 0, 100); civ.cooldown = 6;
        message = "Подарок державе «" + civ.name + "» улучшил отношения.";
      } else if (action === "trade") {
        if (civ.trade) return { ok: false, message: "Торговое соглашение уже действует." };
        if (civ.relation < 0) return { ok: false, message: "Отношения слишком напряжённые. Сначала улучши их до нейтралитета." };
        if (!civ.embassy) return { ok: false, message: "Сначала открой посольство." };
        civ.trade = true; this.adjust(civ, 8, 6); civ.cooldown = 10;
        message = "Подписано торговое соглашение с «" + civ.name + "». Каждый день оно приносит ресурсы.";
      } else if (action === "pact") {
        if (civ.nonAggression > 0) return { ok: false, message: "Пакт о ненападении уже действует." };
        if (civ.relation < 25) return { ok: false, message: "Нужны отношения не ниже 25." };
        if (!civ.embassy) return { ok: false, message: "Для договора требуется посольство." };
        civ.nonAggression = 60; this.adjust(civ, 10, 10); civ.cooldown = 12;
        message = "Подписан пакт о ненападении с «" + civ.name + "» на 60 дней.";
      } else if (action === "culture") {
        if (!civ.embassy) return { ok: false, message: "Сначала открой посольство." };
        if (!pay(15, 5, 0)) return { ok: false, message: "Нужно 15 монет и 5 дерева." };
        this.adjust(civ, 6, 8); this.influence += 2; civ.cooldown = 9;
        message = "Начат культурный обмен с «" + civ.name + "». Получено 2 очка влияния.";
      } else if (action === "science") {
        if (!civ.embassy) return { ok: false, message: "Сначала открой посольство." };
        if (!pay(30, 0, 0)) return { ok: false, message: "Для научного обмена нужно 30 монет." };
        if (C.research) C.research.points += 5;
        this.adjust(civ, 4, 5); civ.cooldown = 12;
        message = "Научная делегация вернулась из «" + civ.name + "». Получено 5 очков науки.";
      } else if (action === "alliance") {
        if (civ.alliance) return { ok: false, message: "Союз уже заключён." };
        if (civ.relation < 65 || civ.nonAggression <= 0) return { ok: false, message: "Для союза нужны отношения от 65 и действующий пакт о ненападении." };
        civ.alliance = true; this.adjust(civ, 12, 10); civ.cooldown = 20;
        message = "Заключён союз с «" + civ.name + "». Союз укрепляет влияние обеих держав.";
      } else {
        return { ok: false, message: "Неизвестное дипломатическое действие." };
      }
      civ.lastAction = message;
      this.record(message);
      C.emit("resources");
      if (C.research) C.emit("research");
      return { ok: true, message: message };
    },

    respond: function (eventId, accept) {
      const item = this.pending.find(p => p.id === eventId);
      if (!item) return { ok: false, message: "Предложение уже недоступно." };
      this.pending = this.pending.filter(p => p.id !== eventId);
      const civ = this.get(item.civId);
      if (!civ) return { ok: false, message: "Цивилизация не найдена." };
      if (accept) {
        if (item.type === "trade") civ.trade = true;
        if (item.type === "pact") civ.nonAggression = 45;
        if (item.type === "culture" && C.research) C.research.points += 3;
        this.adjust(civ, item.reward, 5);
        this.record("Принято предложение державы «" + civ.name + "»: " + item.title + ".");
        C.emit("resources");
      } else {
        this.adjust(civ, -3, -2);
        this.record("Отклонено предложение державы «" + civ.name + "»: " + item.title + ".");
      }
      C.emit("diplomacy");
      return { ok: true };
    },

    daily: function () {
      this.dayCounter++;
      this.civilizations.forEach(civ => {
        if (civ.cooldown > 0) civ.cooldown--;
        if (civ.nonAggression > 0) civ.nonAggression--;
        if (civ.trade) {
          C.state.resources.money += 2;
          if (civ.focus === "food") C.state.resources.food = Math.min(C.infrastructure.storageCapacity(), C.state.resources.food + 1);
          if (civ.focus === "wood") C.state.resources.wood = Math.min(C.infrastructure.storageCapacity(), C.state.resources.wood + 1);
          if (civ.focus === "stone") C.state.resources.stone = Math.min(C.infrastructure.storageCapacity(), C.state.resources.stone + 1);
          if (civ.focus === "science" && C.research) C.research.points = Math.round((C.research.points + 0.2) * 10) / 10;
        }
        if (civ.alliance && this.dayCounter % 10 === 0) this.influence++;
      });
      if (this.dayCounter % 5 === 0) {
        this.civilizations.forEach(civ => {
          const drift = civ.trait === "Дипломаты" ? 1 : 0;
          if (civ.relation < 0 && this.reputation >= 60) this.adjust(civ, 1 + drift, 1);
          else if (civ.relation > 0 && this.reputation < 25) this.adjust(civ, -1, -1);
          if (civ.alliance && civ.relation < 65) civ.relation = 65;
        });
        if (this.pending.length < 2) {
          const candidates = this.civilizations.filter(c => c.embassy && c.cooldown === 0 && !this.pending.some(p => p.civId === c.id));
          if (candidates.length && Math.random() < 0.22) {
            const civ = candidates[Math.floor(Math.random() * candidates.length)];
            const options = civ.trade ? [
              { type: "culture", title: "Совместный культурный фестиваль", reward: 4, text: "Предлагают провести фестиваль и укрепить связи." }
            ] : [
              { type: "trade", title: "Торговое соглашение", reward: 5, text: "Предлагают открыть постоянный торговый обмен." },
              { type: "pact", title: "Пакт о ненападении", reward: 6, text: "Предлагают закрепить мирный договор." },
              { type: "culture", title: "Обмен учёными", reward: 4, text: "Предлагают обменяться учёными и знаниями." }
            ];
            const offer = options[Math.floor(Math.random() * options.length)];
            this.pending.push({ id: String(Date.now()) + civ.id, civId: civ.id, type: offer.type, title: offer.title, text: offer.text, reward: offer.reward });
            this.record("Держава «" + civ.name + "» направила дипломатическое предложение.");
          }
        }
      }
      C.emit("diplomacy");
    },

    exportData: function () {
      return {
        civilizations: this.civilizations.map(c => Object.assign({}, c)),
        reputation: this.reputation, influence: this.influence, envoys: this.envoys,
        pending: this.pending.map(p => Object.assign({}, p)),
        history: this.history.slice(0, 30), dayCounter: this.dayCounter
      };
    },
    importData: function (data) {
      if (!data || typeof data !== "object") return;
      const saved = Array.isArray(data.civilizations) ? data.civilizations : [];
      this.civilizations = fresh().map(base => {
        const old = saved.find(c => c.id === base.id);
        return old ? Object.assign(base, {
          relation: clamp(Number(old.relation) || 0, -100, 100),
          trust: clamp(Number(old.trust) || 0, 0, 100),
          embassy: !!old.embassy, trade: !!old.trade,
          nonAggression: clamp(Number(old.nonAggression) || 0, 0, 60),
          alliance: !!old.alliance, cooldown: clamp(Number(old.cooldown) || 0, 0, 100),
          lastAction: typeof old.lastAction === "string" ? old.lastAction : base.lastAction
        }) : base;
      });
      this.reputation = clamp(Number(data.reputation) || 50, 0, 100);
      this.influence = Math.max(0, Number(data.influence) || 0);
      this.envoys = clamp(Number(data.envoys) || 2, 0, 10);
      this.pending = Array.isArray(data.pending) ? data.pending.slice(0, 2) : [];
      this.history = Array.isArray(data.history) ? data.history.slice(0, 30) : [];
      this.dayCounter = Math.max(0, Number(data.dayCounter) || 0);
    }
  };
})();