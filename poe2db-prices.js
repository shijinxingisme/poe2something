window.POE2DB_PRICE_SNAPSHOT = {
  source: "poe2db Economy",
  sourceUrl: "https://poe2db.tw/cn/Economy",
  updatedAt: "2026-06-26T00:00:00+08:00",
  base: "混沌石",
  prices: [
    { id: "chaos", chaos: 1, note: "基准" },
    { id: "divine", chaos: 9.03, note: "9.03 混沌石 = 1 神圣石" },
    { id: "exalted", chaos: 0.0254, note: "1 神圣石 = 355 崇高石" },
    { id: "annul", chaos: 6.7895, note: "1 神圣石 = 1.33 剥离石" },
    { id: "chance", chaos: 0.228, note: "1 神圣石 = 39.6 机会石" },
    { id: "vaal", chaos: 0.0722, note: "1 神圣石 = 125 瓦尔宝珠" },
    { id: "gcp", chaos: 0.062, note: "2.44 崇高石 = 1 宝石匠的棱镜" },
    { id: "regal", chaos: 0.0137, note: "1 崇高石 = 1.85 富豪石" },
    { id: "alchemy", chaos: 0.0263, note: "1 神圣石 = 343 点金石" }
  ]
};

(function applyPoe2dbSnapshot() {
  function apply() {
    const snapshot = window.POE2DB_PRICE_SNAPSHOT;
    if (!snapshot || !window.Poe2Arb) return;

    snapshot.prices.forEach((price) => {
      const item = window.Poe2Arb.state.prices.find((entry) => entry.id === price.id);
      const input = document.querySelector(`.price-input[data-id="${price.id}"]`);
      if (item) item.chaos = price.chaos;
      if (input) input.value = price.chaos;
    });

    window.Poe2Arb.state.source = "poe2db 快照";
    const status = document.getElementById("market-status");
    if (status) status.textContent = "poe2db 快照";

    const hint = document.querySelector(".import-panel .hint");
    if (hint) {
      const date = new Date(snapshot.updatedAt).toLocaleString("zh-CN");
      hint.textContent = `已自动套用 poe2db Economy 快照价格（${date}）。你仍可粘贴最新行情或手动修改。`;
    }

    const firstInput = document.querySelector(".price-input");
    if (firstInput) firstInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => requestAnimationFrame(apply));
  } else {
    requestAnimationFrame(apply);
  }
})();
