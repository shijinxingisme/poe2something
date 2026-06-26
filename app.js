(function () {
  const samplePrices = [
    { id: "chaos", name: "混沌石", aliases: ["Chaos", "Chaos Orb", "混沌"], chaos: 1 },
    { id: "exalted", name: "崇高石", aliases: ["Exalted", "Exalted Orb", "崇高"], chaos: 20 },
    { id: "divine", name: "神圣石", aliases: ["Divine", "Divine Orb", "神圣"], chaos: 112 },
    { id: "regal", name: "富豪石", aliases: ["Regal", "Regal Orb", "富豪"], chaos: 3.4 },
    { id: "vaal", name: "瓦尔宝珠", aliases: ["Vaal", "Vaal Orb", "瓦尔"], chaos: 1.8 },
    { id: "alchemy", name: "点金石", aliases: ["Alchemy", "Orb of Alchemy", "点金"], chaos: 0.72 },
    { id: "chance", name: "机会石", aliases: ["Chance", "Orb of Chance", "机会"], chaos: 0.42 },
    { id: "annul", name: "剥离石", aliases: ["Annulment", "Orb of Annulment", "剥离"], chaos: 13 },
    { id: "gcp", name: "宝石匠的棱镜", aliases: ["Gemcutter", "Gemcutter's Prism", "棱镜"], chaos: 2.7 }
  ];

  const sampleQuoteText = [
    "混沌石>崇高石=0.052",
    "崇高石>神圣石=0.2",
    "神圣石>混沌石=112",
    "混沌石>富豪石=0.31",
    "富豪石>崇高石=0.18",
    "崇高石>混沌石=20",
    "混沌石>瓦尔宝珠=0.58",
    "瓦尔宝珠>点金石=2.55",
    "点金石>混沌石=1.33",
    "混沌石>神圣石=0.0087",
    "神圣石>崇高石=5.45",
    "崇高石>混沌石=20"
  ].join("\n");

  const state = {
    prices: structuredClone(samplePrices),
    quotes: [],
    source: "示例行情"
  };

  const $ = (id) => document.getElementById(id);
  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const round = (value, digits = 2) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;
  const pct = (value) => `${round(value * 100, 2)}%`;
  const fmt = (value) => round(value, 4).toLocaleString("zh-CN");

  function findCurrency(token) {
    const text = String(token).trim().toLowerCase();
    return state.prices.find((item) =>
      item.id.toLowerCase() === text ||
      item.name.toLowerCase() === text ||
      item.aliases.some((alias) => alias.toLowerCase() === text)
    );
  }

  function parseQuotes(text) {
    return String(text)
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(.+?)\s*(?:>|→|->)\s*(.+?)\s*=\s*([0-9]*\.?[0-9]+)$/);
        if (!match) return null;
        const from = findCurrency(match[1]);
        const to = findCurrency(match[2]);
        const rate = number(match[3]);
        if (!from || !to || from.id === to.id || rate <= 0) return null;
        return { from: from.id, to: to.id, rate, source: "手动报价" };
      })
      .filter(Boolean);
  }

  function generatedQuotes() {
    const spread = 0.985;
    const quotes = [];
    state.prices.forEach((from) => {
      state.prices.forEach((to) => {
        if (from.id !== to.id && from.chaos > 0 && to.chaos > 0) {
          quotes.push({ from: from.id, to: to.id, rate: (from.chaos / to.chaos) * spread, source: "价格推算" });
        }
      });
    });
    return quotes;
  }

  function bestRateMap() {
    const map = new Map();
    [...generatedQuotes(), ...state.quotes].forEach((quote) => {
      const key = `${quote.from}>${quote.to}`;
      const old = map.get(key);
      if (!old || quote.rate > old.rate || quote.source === "手动报价") map.set(key, quote);
    });
    return map;
  }

  function scanArbitrage({ startId, startAmount, topN, minProfit }) {
    const rates = bestRateMap();
    const currencies = state.prices.map((item) => item.id);
    const results = [];

    currencies.forEach((b) => {
      currencies.forEach((c) => {
        if (startId === b || startId === c || b === c) return;
        const q1 = rates.get(`${startId}>${b}`);
        const q2 = rates.get(`${b}>${c}`);
        const q3 = rates.get(`${c}>${startId}`);
        if (!q1 || !q2 || !q3) return;
        const finalAmount = startAmount * q1.rate * q2.rate * q3.rate;
        const profit = finalAmount - startAmount;
        const roi = profit / startAmount;
        if (roi >= minProfit) {
          results.push({ path: [startId, b, c, startId], finalAmount, profit, roi, quotes: [q1, q2, q3] });
        }
      });
    });

    return results.sort((a, b) => b.roi - a.roi).slice(0, topN);
  }

  function parsePriceImport(text) {
    const updates = [];
    String(text).split(/\n+/).forEach((line) => {
      const clean = line.replace(/[,，]/g, " ").trim();
      if (!clean) return;
      const currency = state.prices.find((item) => [item.name, item.id, ...item.aliases].some((name) => clean.toLowerCase().includes(name.toLowerCase())));
      const values = clean.match(/\d+(?:\.\d+)?/g)?.map(Number).filter((value) => value > 0) || [];
      if (currency && values.length) updates.push({ id: currency.id, chaos: values[0] });
    });
    return updates;
  }

  function nameOf(id) {
    return state.prices.find((item) => item.id === id)?.name || id;
  }

  function renderCurrencyOptions() {
    const selected = $("start-currency").value || "chaos";
    $("start-currency").innerHTML = state.prices.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
    $("start-currency").value = state.prices.some((item) => item.id === selected) ? selected : "chaos";
  }

  function renderPriceList() {
    $("price-list").innerHTML = state.prices.map((item) => `
      <label class="price-row">
        <span class="price-name">${item.name}</span>
        <input class="price-input" data-id="${item.id}" type="number" min="0.0001" step="0.0001" value="${item.chaos}" />
      </label>
    `).join("");
  }

  function renderOpportunities() {
    const startId = $("start-currency").value || "chaos";
    const startAmount = Math.max(0.0001, number($("start-amount").value, 100));
    const topN = Math.max(1, Math.min(20, Math.round(number($("top-n").value, 6))));
    const minProfit = Math.max(0, number($("min-profit").value, 0.5)) / 100;
    const opportunities = scanArbitrage({ startId, startAmount, topN, minProfit });
    const allQuotes = bestRateMap();

    $("quote-count").textContent = allQuotes.size;
    $("deal-count").textContent = opportunities.length;
    $("best-gain").textContent = opportunities[0] ? pct(opportunities[0].roi) : "0%";
    $("market-status").textContent = state.source;

    if (!opportunities.length) {
      $("opportunity-list").innerHTML = `<div class="empty">当前参数下没有超过最低收益率的 A→B→C→A 闭环。可以降低最低收益率，或补充更多实际交易报价。</div>`;
      return;
    }

    $("opportunity-list").innerHTML = opportunities.map((item, index) => `
      <article class="opportunity ${index === 0 ? "hot" : ""}">
        <div class="path-line">${item.path.map((part) => `<span>${nameOf(part)}</span>`).join("→")}</div>
        <div class="profit-line">
          <div><small>投入</small><strong>${fmt(startAmount)} ${nameOf(startId)}</strong></div>
          <div><small>回收</small><strong>${fmt(item.finalAmount)} ${nameOf(startId)}</strong></div>
          <div><small>收益率</small><strong>${pct(item.roi)}</strong></div>
        </div>
        <small>${item.quotes.map((quote) => `${nameOf(quote.from)}→${nameOf(quote.to)} ${fmt(quote.rate)}`).join(" ｜ ")}</small>
      </article>
    `).join("");
  }

  function bindEvents() {
    document.addEventListener("input", (event) => {
      if (event.target.classList.contains("price-input")) {
        const item = state.prices.find((price) => price.id === event.target.dataset.id);
        if (item) item.chaos = Math.max(0.0001, number(event.target.value, item.chaos));
      }
      renderOpportunities();
    });

    $("apply-quotes").addEventListener("click", () => {
      state.quotes = parseQuotes($("quote-input").value);
      state.source = state.quotes.length ? "手动报价" : "价格推算";
      renderOpportunities();
    });

    $("import-prices").addEventListener("click", () => {
      const updates = parsePriceImport($("price-import").value);
      updates.forEach((update) => {
        const item = state.prices.find((price) => price.id === update.id);
        if (item) item.chaos = update.chaos;
      });
      state.source = updates.length ? "poe2db 导入" : state.source;
      renderPriceList();
      renderCurrencyOptions();
      renderOpportunities();
    });

    $("reset-sample").addEventListener("click", () => {
      state.prices = structuredClone(samplePrices);
      state.quotes = parseQuotes(sampleQuoteText);
      state.source = "示例行情";
      $("quote-input").value = sampleQuoteText;
      $("price-import").value = "";
      renderPriceList();
      renderCurrencyOptions();
      renderOpportunities();
    });

    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".tab, .tab-page").forEach((node) => node.classList.remove("active"));
        button.classList.add("active");
        $(`${button.dataset.tab}-page`).classList.add("active");
      });
    });
  }

  function init() {
    state.quotes = parseQuotes(sampleQuoteText);
    $("quote-input").value = sampleQuoteText;
    renderCurrencyOptions();
    renderPriceList();
    bindEvents();
    renderOpportunities();
  }

  const api = { parseQuotes, parsePriceImport, scanArbitrage, generatedQuotes, bestRateMap, state };
  if (typeof window !== "undefined") {
    window.Poe2Arb = api;
    document.addEventListener("DOMContentLoaded", init);
  }
})();
