(function () {
  const samplePrices = [
    { id: "chaos", name: "混沌石", aliases: ["Chaos", "Chaos Orb", "混沌", "C"], chaos: 1 },
    { id: "exalted", name: "崇高石", aliases: ["Exalted", "Exalted Orb", "崇高", "Exalt", "Ex", "E"], chaos: 20 },
    { id: "divine", name: "神圣石", aliases: ["Divine", "Divine Orb", "神圣", "Div", "D"], chaos: 112 },
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
    "点金石>混沌石=1.33"
  ].join("\n");

  const slugToId = {
    chaos: "chaos",
    exalted: "exalted",
    divine: "divine",
    regal: "regal",
    vaal: "vaal",
    alch: "alchemy",
    chance: "chance",
    annul: "annul",
    gcp: "gcp"
  };

  const state = {
    prices: structuredClone(samplePrices),
    quotes: [],
    source: "示例行情",
    watchTimer: null,
    watchActive: false,
    lastAlertKey: ""
  };

  const $ = (id) => document.getElementById(id);
  const number = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const round = (value, digits = 2) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;
  const pct = (value) => `${round(value * 100, 2)}%`;
  const fmt = (value) => round(value, 4).toLocaleString("zh-CN");

  function setHint(text) {
    const hint = $("price-hint");
    if (hint) hint.textContent = text;
  }

  function findCurrency(token) {
    const text = String(token).trim().toLowerCase();
    return state.prices.find((item) =>
      item.id.toLowerCase() === text ||
      item.name.toLowerCase() === text ||
      item.aliases.some((alias) => alias.toLowerCase() === text)
    );
  }

  function currencyChaosValue(id) {
    return state.prices.find((item) => item.id === id)?.chaos || 0;
  }

  function toChaos(amount, currencyId) {
    return amount * currencyChaosValue(currencyId);
  }

  function parseCurrencyUnit(unitText, fallbackId) {
    const text = String(unitText || "").trim().toLowerCase();
    if (!text) return fallbackId;
    if (["d", "div", "divine", "神圣", "神圣石"].includes(text)) return "divine";
    if (["e", "ex", "exalt", "exalted", "崇高", "崇高石"].includes(text)) return "exalted";
    if (["c", "chaos", "混沌", "混沌石"].includes(text)) return "chaos";
    const found = findCurrency(text);
    return found ? found.id : fallbackId;
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

  function parsePoe2dbPrices(html) {
    const rows = [];
    const rowMatches = String(html).match(/<tr>[\s\S]*?<\/tr>/g) || [];
    rowMatches.forEach((row) => {
      const nameMatch = row.match(/<a href="Economy_[^"]+"><img[^>]+\/>([^<]+)<\/a>/);
      const priceMatch = row.match(/<td>\s*([\d.,]+)\s*<a href="Economy_([^"]+)">[\s\S]*?<\/a>\s*<i[^>]*><\/i>\s*([\d.,]+)\s*<a href="Economy_([^"]+)">/);
      if (!nameMatch || !priceMatch) return;
      rows.push({
        name: nameMatch[1].trim(),
        baseAmount: Number(priceMatch[1].replace(/,/g, "")),
        base: priceMatch[2],
        targetAmount: Number(priceMatch[3].replace(/,/g, "")),
        target: priceMatch[4]
      });
    });

    const raw = new Map(rows.map((row) => [row.target, row]));
    const divineRow = raw.get("divine");
    if (!divineRow) return [];

    const chaos = { chaos: 1, divine: divineRow.baseAmount / divineRow.targetAmount };
    let changed = true;
    while (changed) {
      changed = false;
      Object.entries(slugToId).forEach(([slug, id]) => {
        if (chaos[id] || !raw.has(slug)) return;
        const row = raw.get(slug);
        const baseId = slugToId[row.base];
        if (baseId && chaos[baseId]) {
          chaos[id] = chaos[baseId] * row.baseAmount / row.targetAmount;
          changed = true;
        }
      });
    }

    return Object.entries(chaos)
      .map(([id, value]) => ({ id, chaos: round(value, 6) }))
      .filter((item) => state.prices.some((price) => price.id === item.id));
  }

  function applyPriceUpdates(updates, source) {
    updates.forEach((update) => {
      const item = state.prices.find((price) => price.id === update.id);
      if (item && update.chaos > 0) item.chaos = update.chaos;
    });
    state.source = source;
    renderPriceList();
    renderCurrencyOptions();
    renderWatchCurrencyOptions();
    renderOpportunities();
  }

  async function fetchText(url, authText = "") {
    const headers = parseAuthHeaders(authText);
    const directOptions = { cache: "no-store", headers };
    const direct = await fetch(url, directOptions);
    if (!direct.ok) throw new Error(`请求失败：${direct.status}`);
    return direct.text();
  }

  async function fetchPublicText(url) {
    try {
      return await fetchText(url);
    } catch (directError) {
      const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxy, { cache: "no-store" });
      if (!response.ok) throw directError;
      return response.text();
    }
  }

  async function refreshPoe2dbPrices() {
    const button = $("refresh-prices");
    button.disabled = true;
    button.textContent = "刷新中...";
    setHint("正在从 poe2db 获取最新物价...");
    try {
      const html = await fetchPublicText("https://poe2db.tw/cn/Economy");
      const updates = parsePoe2dbPrices(html);
      if (updates.length < 5) throw new Error("没有解析到足够的通货价格");
      applyPriceUpdates(updates, "poe2db 现刷");
      const time = new Date().toLocaleString("zh-CN");
      setHint(`已刷新 poe2db 物价（${time}）。如果价格看起来异常，请打开 poe2db 对照确认。`);
    } catch (error) {
      setHint(`刷新物价失败：${error.message}。多数情况是浏览器跨站限制，可以打开 poe2db 后复制行情到这里导入。`);
    } finally {
      button.disabled = false;
      button.textContent = "刷新物价";
    }
  }

  function parseAuthHeaders(text) {
    const headers = {};
    String(text).split(/\n+/).forEach((line) => {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (!match) return;
      const key = match[1].trim();
      const value = match[2].trim();
      if (/^cookie$/i.test(key)) return;
      if (/^(authorization|x-|accept|content-type)/i.test(key)) headers[key] = value;
    });
    return headers;
  }

  function extractPrices(text, patternText, defaultUnitId) {
    let pattern;
    try {
      pattern = new RegExp(patternText, "gi");
    } catch (_) {
      pattern = /([0-9]+(?:\.[0-9]+)?)\s*(D|Div|Divine|神圣|E|Ex|Exalt|崇高|C|Chaos|混沌)?/gi;
    }
    const prices = [];
    let match;
    while ((match = pattern.exec(text)) && prices.length < 200) {
      const value = Number(String(match[1] || match[0]).replace(/,/g, ""));
      if (!Number.isFinite(value)) continue;
      const currencyId = parseCurrencyUnit(match[2], defaultUnitId);
      const chaosValue = toChaos(value, currencyId);
      if (chaosValue > 0) prices.push({ amount: value, currencyId, chaosValue });
    }
    return prices.sort((a, b) => a.chaosValue - b.chaosValue);
  }

  function setWatchStatus(text, mood = "") {
    const box = $("watch-status");
    box.className = `watch-status ${mood}`.trim();
    box.textContent = text;
  }

  function addWatchLog(text) {
    const item = document.createElement("div");
    item.textContent = `${new Date().toLocaleTimeString("zh-CN")} ${text}`;
    $("watch-log").prepend(item);
    while ($("watch-log").children.length > 8) $("watch-log").lastElementChild.remove();
  }

  async function notifyBargain(message) {
    if ("Notification" in window) {
      if (Notification.permission === "default") await Notification.requestPermission();
      if (Notification.permission === "granted") new Notification("POE2 淘宝模式提醒", { body: message });
    }
  }

  function describePrice(price) {
    return `${fmt(price.amount)} ${nameOf(price.currencyId)}（约 ${fmt(price.chaosValue)} 混沌石）`;
  }

  async function checkMarketOnce() {
    const url = $("market-url").value.trim();
    const targetAmount = number($("target-price").value);
    const targetUnit = $("target-unit").value || "divine";
    const defaultDetectedUnit = $("detected-unit").value || targetUnit;
    const targetChaos = toChaos(targetAmount, targetUnit);
    const pattern = $("price-pattern").value.trim();
    const auth = $("auth-token").value;
    if (!url || targetAmount <= 0 || targetChaos <= 0) {
      setWatchStatus("请先填写集市地址、目标价格和单位。", "alert");
      return;
    }
    if (/^\s*cookie\s*:/im.test(auth)) {
      addWatchLog("检测到 Cookie：浏览器页面不能可靠手动发送 Cookie，建议使用 Authorization token 或后端代理。");
    }

    try {
      setWatchStatus("正在检查集市价格...", "");
      const text = auth.trim() ? await fetchText(url, auth) : await fetchPublicText(url);
      const prices = extractPrices(text, pattern, defaultDetectedUnit);
      if (!prices.length) {
        setWatchStatus("已检查，但没有识别到价格。请调整价格识别规则。", "alert");
        addWatchLog("没有识别到价格。");
        return;
      }
      const best = prices[0];
      const targetText = `${fmt(targetAmount)} ${nameOf(targetUnit)}（约 ${fmt(targetChaos)} 混沌石）`;
      if (best.chaosValue <= targetChaos) {
        const message = `发现低价：${describePrice(best)}，低于目标 ${targetText}`;
        setWatchStatus(message, "alert");
        addWatchLog(message);
        const alertKey = `${url}:${best.chaosValue}:${targetChaos}`;
        if (alertKey !== state.lastAlertKey) {
          state.lastAlertKey = alertKey;
          await notifyBargain(message);
        }
      } else {
        const message = `已检查，最低识别价 ${describePrice(best)}，高于目标 ${targetText}。`;
        setWatchStatus(message, "good");
        addWatchLog(message);
      }
    } catch (error) {
      setWatchStatus(`检查失败：${error.message}。如果目标站点限制跨站读取，需要后端代理或手动查看。`, "alert");
      addWatchLog(`检查失败：${error.message}`);
    }
  }

  function toggleWatch() {
    const button = $("toggle-watch");
    if (state.watchActive) {
      clearInterval(state.watchTimer);
      state.watchTimer = null;
      state.watchActive = false;
      button.classList.remove("active");
      button.textContent = "开启淘宝模式";
      setWatchStatus("淘宝模式已关闭。", "");
      return;
    }

    const intervalSeconds = Math.max(60, number($("watch-interval").value, 180));
    $("watch-interval").value = intervalSeconds;
    state.watchActive = true;
    button.classList.add("active");
    button.textContent = "关闭淘宝模式";
    setWatchStatus(`淘宝模式已开启，每 ${intervalSeconds} 秒检查一次。`, "good");
    checkMarketOnce();
    state.watchTimer = setInterval(checkMarketOnce, intervalSeconds * 1000);
  }

  function nameOf(id) {
    return state.prices.find((item) => item.id === id)?.name || id;
  }

  function renderCurrencyOptions() {
    const selected = $("start-currency").value || "chaos";
    $("start-currency").innerHTML = state.prices.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
    $("start-currency").value = state.prices.some((item) => item.id === selected) ? selected : "chaos";
  }

  function renderWatchCurrencyOptions() {
    ["target-unit", "detected-unit"].forEach((id) => {
      const element = $(id);
      if (!element) return;
      const selected = element.value || (id === "target-unit" ? "divine" : "exalted");
      element.innerHTML = state.prices.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
      element.value = state.prices.some((item) => item.id === selected) ? selected : "chaos";
    });
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

    $("refresh-prices").addEventListener("click", refreshPoe2dbPrices);
    $("toggle-watch").addEventListener("click", toggleWatch);
    $("apply-quotes").addEventListener("click", () => {
      state.quotes = parseQuotes($("quote-input").value);
      state.source = state.quotes.length ? "手动报价" : "价格推算";
      renderOpportunities();
    });

    $("import-prices").addEventListener("click", () => {
      const updates = parsePriceImport($("price-import").value);
      if (updates.length) applyPriceUpdates(updates, "poe2db 导入");
    });

    $("reset-sample").addEventListener("click", () => {
      state.prices = structuredClone(samplePrices);
      state.quotes = parseQuotes(sampleQuoteText);
      state.source = "示例行情";
      $("quote-input").value = sampleQuoteText;
      $("price-import").value = "";
      renderPriceList();
      renderCurrencyOptions();
      renderWatchCurrencyOptions();
      renderOpportunities();
      setHint("已恢复示例行情；需要最新数据时点“刷新物价”。");
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
    renderWatchCurrencyOptions();
    renderPriceList();
    bindEvents();
    renderOpportunities();
  }

  const api = { parseQuotes, parsePriceImport, parsePoe2dbPrices, extractPrices, toChaos, parseCurrencyUnit, scanArbitrage, generatedQuotes, bestRateMap, state };
  if (typeof window !== "undefined") {
    window.Poe2Arb = api;
    document.addEventListener("DOMContentLoaded", init);
  }
})();
