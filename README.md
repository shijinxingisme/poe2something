# POE2 市场套利分析器

这是一个 POE2 通货市场套利分析 Web 应用。它会读取 poe2db Economy 行情快照，并支持你手动录入实际交易报价，扫描 A→B→C→A 三步闭环路径，按收益率展示 Top N 套利机会。

## 核心功能

- 默认套用 poe2db Economy 快照价格
- 每 6 小时通过 GitHub Actions 尝试刷新一次 poe2db 快照
- 维护通货价格表，价格统一折算为混沌石
- 支持从 poe2db Economy 页面复制通货行并手动导入价格
- 支持手动录入实际交易报价，例如：`混沌石>崇高石=0.052`
- 扫描 A→B→C→A 闭环路径
- 展示投入、回收、收益率和使用到的三段报价
- 支持设置起点通货、投入数量、Top N 和最低收益率

## 数据来源

行情来源：<https://poe2db.tw/cn/Economy>

静态网页本身不会直接跨站抓取 poe2db，而是读取仓库中的 `poe2db-prices.js` 快照。仓库包含一个定时任务，会定期请求 poe2db 并更新该快照。如果自动更新失败，页面仍可使用上一次快照，也可以手动粘贴行情更新。

实际套利判断建议以游戏内和交易站即时挂单为准。

## 使用方式

打开 GitHub Pages 页面即可使用：

<https://shijinxingisme.github.io/poe2something/>
