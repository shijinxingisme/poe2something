import json
import re
import urllib.request
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

URL = "https://poe2db.tw/cn/Economy"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "poe2db-prices.js"

APP_IDS = {
    "chaos": "chaos",
    "exalted": "exalted",
    "divine": "divine",
    "regal": "regal",
    "vaal": "vaal",
    "alch": "alchemy",
    "chance": "chance",
    "annul": "annul",
    "gcp": "gcp",
}

NAMES = {
    "chaos": "混沌石",
    "exalted": "崇高石",
    "divine": "神圣石",
    "regal": "富豪石",
    "vaal": "瓦尔宝珠",
    "alchemy": "点金石",
    "chance": "机会石",
    "annul": "剥离石",
    "gcp": "宝石匠的棱镜",
}


def to_float(value):
    return float(value.replace(",", ""))


def fetch_html():
    request = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8", "ignore")


def parse_rows(html):
    rows = []
    for row in re.findall(r"<tr>(.*?)</tr>", html, flags=re.S):
        name_match = re.search(r'<a href="Economy_[^"]+"><img[^>]+/>([^<]+)</a>', row)
        price_match = re.search(
            r'<td>\s*([\d.,]+)\s*<a href="Economy_([^"]+)">.*?</a>\s*<i[^>]*></i>\s*([\d.,]+)\s*<a href="Economy_([^"]+)">',
            row,
            flags=re.S,
        )
        if not name_match or not price_match:
            continue
        rows.append({
            "name": unescape(name_match.group(1)).strip(),
            "base_amount": to_float(price_match.group(1)),
            "base": price_match.group(2),
            "target_amount": to_float(price_match.group(3)),
            "target": price_match.group(4),
        })
    return rows


def compute_prices(rows):
    raw = {row["target"]: row for row in rows}
    if "chaos" not in raw or "divine" not in raw:
        raise RuntimeError("Could not find chaos/divine rows in poe2db Economy page")

    chaos = {"chaos": 1.0}
    divine_row = raw["divine"]
    chaos["divine"] = divine_row["base_amount"] / divine_row["target_amount"]

    # Keep resolving prices until no more known app currencies can be derived.
    changed = True
    while changed:
        changed = False
        for slug, app_id in APP_IDS.items():
            if app_id in chaos or slug not in raw:
                continue
            row = raw[slug]
            base_app_id = APP_IDS.get(row["base"])
            if base_app_id in chaos:
                chaos[app_id] = chaos[base_app_id] * row["base_amount"] / row["target_amount"]
                changed = True

    prices = []
    for app_id in ["chaos", "divine", "exalted", "annul", "chance", "vaal", "gcp", "regal", "alchemy"]:
        if app_id in chaos:
            prices.append({"id": app_id, "chaos": round(chaos[app_id], 6), "name": NAMES.get(app_id, app_id)})
    return prices


def write_snapshot(prices):
    payload = {
        "source": "poe2db Economy",
        "sourceUrl": URL,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "base": "混沌石",
        "prices": prices,
    }
    content = "window.POE2DB_PRICE_SNAPSHOT = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n\n"
    content += r'''(function applyPoe2dbSnapshot() {
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
'''
    OUT.write_text(content, encoding="utf-8")


def main():
    rows = parse_rows(fetch_html())
    prices = compute_prices(rows)
    if len(prices) < 5:
        raise RuntimeError(f"Only parsed {len(prices)} prices; refusing to update snapshot")
    write_snapshot(prices)
    print(json.dumps(prices, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
