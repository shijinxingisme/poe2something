(function () {
  const ids = {
    targetDivines: "target-divines",
    divineChaos: "divine-chaos",
    divineExalt: "divine-exalt",
    exaltChaos: "exalt-chaos",
    ownedChaos: "owned-chaos",
    ownedExalt: "owned-exalt"
  };

  function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }

  function format(value, unit) {
    return `${round(value).toLocaleString("zh-CN")} ${unit}`;
  }

  function calculate(input) {
    const targetDivines = toNumber(input.targetDivines);
    const divineChaos = toNumber(input.divineChaos);
    const divineExalt = toNumber(input.divineExalt);
    const exaltChaos = toNumber(input.exaltChaos);
    const ownedChaos = Math.max(0, toNumber(input.ownedChaos));
    const ownedExalt = Math.max(0, toNumber(input.ownedExalt));

    if (targetDivines <= 0 || divineChaos <= 0 || divineExalt <= 0 || exaltChaos <= 0) {
      return { valid: false, message: "需要兑换数量和三个市场比例都必须大于 0。" };
    }

    const chaosRouteCost = targetDivines * divineChaos;
    const exaltNeeded = targetDivines * divineExalt;
    const exaltRouteCost = exaltNeeded * exaltChaos;
    const breakEvenExaltChaos = divineChaos / divineExalt;
    const difference = Math.abs(chaosRouteCost - exaltRouteCost);
    const savingPercent = difference / Math.max(chaosRouteCost, exaltRouteCost);
    const tied = difference < 0.000001;
    const bestRoute = tied ? "tie" : exaltRouteCost < chaosRouteCost ? "exalt" : "chaos";
    const ownedValueInChaos = ownedChaos + ownedExalt * exaltChaos;
    const bestCost = Math.min(chaosRouteCost, exaltRouteCost);
    const shortfall = Math.max(0, bestCost - ownedValueInChaos);

    return {
      valid: true,
      targetDivines,
      divineChaos,
      divineExalt,
      exaltChaos,
      chaosRouteCost,
      exaltNeeded,
      exaltRouteCost,
      breakEvenExaltChaos,
      difference,
      savingPercent,
      bestRoute,
      tied,
      ownedValueInChaos,
      shortfall
    };
  }

  function collectInput() {
    return Object.fromEntries(
      Object.entries(ids).map(([key, id]) => [key, document.getElementById(id).value])
    );
  }

  function setText(id, text) {
    document.getElementById(id).textContent = text;
  }

  function renderSteps(result) {
    const steps = document.getElementById("steps");
    steps.innerHTML = "";

    const lines =
      result.bestRoute === "exalt"
        ? [
            `准备 ${format(result.exaltNeeded, "崇高石")}，按当前比例兑换 ${format(result.targetDivines, "神圣石")}。`,
            `这条路线折算约 ${format(result.exaltRouteCost, "混沌石")}，比直接用混沌石少花 ${format(result.difference, "混沌石")}。`
          ]
        : result.bestRoute === "chaos"
          ? [
              `准备 ${format(result.chaosRouteCost, "混沌石")}，直接兑换 ${format(result.targetDivines, "神圣石")}。`,
              `这条路线比先换崇高石少花 ${format(result.difference, "混沌石")}。`
            ]
          : [
              `两条路线成本几乎一致，都可以兑换 ${format(result.targetDivines, "神圣石")}。`,
              "优先选择交易更快、库存更充足的那条路线。"
            ];

    if (result.shortfall > 0) {
      lines.push(`按你填写的库存估算，还差约 ${format(result.shortfall, "混沌石")} 的购买力。`);
    } else if (result.ownedValueInChaos > 0) {
      lines.push("按你填写的库存估算，当前购买力足够完成这次兑换。");
    }

    lines.forEach((line) => {
      const item = document.createElement("div");
      item.className = "step";
      item.textContent = line;
      steps.appendChild(item);
    });
  }

  function render() {
    const result = calculate(collectInput());

    if (!result.valid) {
      setText("recommendation", "无法计算");
      setText("reason", result.message);
      setText("confidence-label", "需要修正输入");
      setText("chaos-cost", "-");
      setText("exalt-cost", "-");
      setText("saving", "-");
      document.getElementById("steps").innerHTML = "";
      document.getElementById("break-even").innerHTML = `<span class="error">${result.message}</span>`;
      return;
    }

    const routeText = {
      exalt: "建议用崇高石换",
      chaos: "建议用混沌石换",
      tie: "两条路线接近"
    }[result.bestRoute];

    setText("recommendation", routeText);
    setText(
      "reason",
      result.tied
        ? "当前比例下两条路线折算成本几乎一样，交易速度和实际挂单量会比微小价差更重要。"
        : result.bestRoute === "exalt"
          ? "崇高石路线折算成混沌石后成本更低。"
          : "直接用混沌石兑换神圣石的成本更低。"
    );
    setText("confidence-label", result.savingPercent >= 0.08 ? "价差明显" : "价差较小");
    setText("chaos-cost", format(result.chaosRouteCost, "C"));
    setText("exalt-cost", format(result.exaltRouteCost, "C"));
    setText("saving", result.tied ? "0 C" : format(result.difference, "C"));

    renderSteps(result);

    const condition =
      result.exaltChaos < result.breakEvenExaltChaos
        ? "低于临界价，崇高石路线占优"
        : result.exaltChaos > result.breakEvenExaltChaos
          ? "高于临界价，混沌石路线占优"
          : "正好接近临界价";

    document.getElementById("break-even").textContent =
      `临界点：当 1 崇高石约等于 ${format(result.breakEvenExaltChaos, "混沌石")} 时，两条路线成本相同。当前是 ${format(result.exaltChaos, "混沌石")}，${condition}。`;
  }

  if (typeof document !== "undefined") {
    document.addEventListener("input", render);
    document.addEventListener("DOMContentLoaded", render);
  }

  const api = { calculate, round };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.Poe2Calculator = api;
})();
