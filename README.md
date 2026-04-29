# CryptoPulse - 加密资讯日报生成器

CryptoPulse 是一个自动化的加密货币资讯日报生成系统，每天从**完全免费的API**获取加密货币市场数据和新闻，生成双语（英文/中文）日报报告。

## 🆓 完全免费方案

**无需API密钥！所有API都是免费公开访问的：**

- **市场数据**: CryptoPrice API + Coinbase API (免费)
- **比特币数据**: Blockchain.info (免费)
- **新闻数据**: RSS feeds + rss2json (免费)

## 功能特性

- 📊 **多源数据获取**: 从多个免费API获取实时数据
- 📰 **新闻聚合**: 整合最新的加密货币相关新闻
- 🌍 **双语报告**: 自动生成英文和中文版本的日报
- 📅 **日期归档**: 按日期组织报告文件，便于查阅历史记录
- 🔄 **自动化流程**: 一键生成完整日报，支持 Git 自动提交
- 💰 **完全免费**: 无需任何API密钥或付费订阅

## 项目结构

```
CryptoPulse/
├── generate-daily-report.sh    # 主脚本 - 完整日报生成流程
├── scripts/
│   └── fetch-data.js           # 数据获取脚本（使用免费API）
├── data/                       # 原始数据存储
│   └── raw-data.json
├── en/2026/                    # 英文报告目录
│   └── YYYY-MM-DD.md
├── zh/2026/                    # 中文报告目录
│   └── YYYY-MM-DD.md
├── API_CONFIG.md              # API配置指南
├── SOLUTION.md                # 完整解决方案
└── package.json               # 项目配置
```

## 快速开始

### 前置要求

- Node.js 16.0 或更高版本
- Git（可选，用于自动提交报告）

### 安装依赖

```bash
npm install
```

### 生成日报

#### 方法一：使用主脚本（推荐）

```bash
# 生成完整日报（包含 Git 提交）
./generate-daily-report.sh

# 生成日报但跳过 Git 操作
./generate-daily-report.sh --no-git
```

#### 方法二：分步执行

```bash
# 1. 获取数据
node scripts/fetch-data.js

# 2. 生成报告
node scripts/generate-report.js
```

#### 方法三：使用 npm 脚本

```bash
# 获取数据
npm run fetch

# 生成报告
npm run generate

# 完整流程
npm start
```

## 数据源

系统从以下**免费数据源**获取信息：

1. **CryptoPrice API** - 加密货币市场数据（价格、市值、交易量等）
2. **Coinbase API** - 备用市场数据源
3. **Blockchain.info** - 比特币实时数据
4. **RSS feeds** - 加密货币新闻（Cointelegraph, CoinDesk等）

## 报告内容

每份日报包含以下部分：

1. **市场概览** - 前10大加密货币的实时数据
2. **比特币重点** - BTC 的详细市场指标
3. **最新资讯** - 精选的加密货币新闻
4. **免责声明** - 投资风险提示

## 配置选项

### 修改数据源

编辑 `scripts/fetch-data.js` 文件，添加或修改数据获取函数：

```javascript
async function fetchCustomDataSource() {
  // 添加你的数据源逻辑
}
```

### 修改报告格式

编辑 `scripts/generate-report.js` 文件，调整报告生成逻辑：

```javascript
function generateCustomReport(data, date) {
  // 自定义报告格式
}
```

### 调整报告数量

修改 `generateEnglishReport` 和 `generateChineseReport` 函数中的 `slice()` 参数：

```javascript
// 显示前5条新闻
news.slice(0, 5).forEach((article, index) => {
  // ...
});
```

## 自动化部署

### 设置定时任务（Linux/macOS）

使用 cron 设置每天定时生成报告：

```bash
# 编辑 crontab
crontab -e

# 添加以下行（每天上午8点执行）
0 8 * * * cd /path/to/CryptoPulse && ./generate-daily-report.sh
```

### GitHub Actions（推荐）

创建 `.github/workflows/daily-report.yml`：

```yaml
name: Daily Crypto Report

on:
  schedule:
    - cron: '0 8 * * *'  # 每天 UTC 8:00
  workflow_dispatch:  # 手动触发

jobs:
  generate-report:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'

    - name: Generate Daily Report
      run: |
        ./generate-daily-report.sh --no-git

    - name: Commit and Push
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add .
        git commit -m "Daily: $(date +%Y-%m-%d) - auto-generated report" || echo "No changes to commit"
        git push
```

## 故障排除

### 常见问题

1. **API 调用失败**
   - 检查网络连接
   - 确认 API 服务可用
   - 系统会自动使用备用源继续运行

2. **报告文件未生成**
   - 检查 `data/raw-data.json` 是否存在
   - 确认目录权限正确

3. **Git 提交失败**
   - 检查 Git 配置
   - 确认有推送权限
   - 使用 `--no-git` 参数跳过 Git 操作

### 调试模式

查看详细日志：

```bash
# 查看数据获取详细信息
node scripts/fetch-data.js

# 查看报告生成详细信息
node scripts/generate-report.js
```

## 开发指南

### 添加新的免费API

1. 在 `scripts/fetch-data.js` 中添加新的获取函数
2. 在 `main()` 函数中调用新函数
3. 更新数据结构和报告生成逻辑

### 修改报告模板

1. 编辑 `generateEnglishReport()` 或 `generateChineseReport()`
2. 调整 Markdown 格式
3. 测试生成效果

## 许可证

MIT License

## 贡献指南

欢迎提交 Issue 和 Pull Request！

---

**注意**：本工具生成的报告仅供参考，不构成投资建议。加密货币投资存在风险，请谨慎决策。