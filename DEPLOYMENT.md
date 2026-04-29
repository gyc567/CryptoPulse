# 🚀 CryptoPulse 部署指南

## ✅ 已完成的部署步骤

### 1. GitHub Actions 自动化配置 ✅
- **文件**: `.github/workflows/daily-report.yml`
- **触发时间**: 每天北京时间早上8点 (UTC 0:00)
- **功能**: 自动生成报告并提交到仓库

### 2. 优化数据源 ✅
- **多API备份**: CryptoPrice + CoinGecko + Coinbase
- **新闻源扩展**: 5个RSS源（Cointelegraph, CoinDesk, CryptoPotato, NewsBTC, CryptoCoinsNews）
- **错误处理**: 自动故障转移和回退机制

### 3. 代码推送 ✅
- **仓库**: `github.com:gyc567/CryptoPulse`
- **分支**: main
- **状态**: 已成功推送

## 🔧 GitHub Actions 配置步骤

### 步骤1: 启用 GitHub Actions

1. 访问 GitHub 仓库: `https://github.com/gyc567/CryptoPulse`
2. 点击 **Settings** → **Actions** → **General**
3. 确保 **Actions permissions** 设置为 **Allow all actions**

### 步骤2: 配置 Secrets (可选)

如果需要使用 NewsData.io API 获取更稳定的新闻数据：

1. 访问 **Settings** → **Secrets and variables** → **Actions**
2. 点击 **New repository secret**
3. 添加以下 secret:
   - **名称**: `NEWSDATA_API_KEY`
   - **值**: 从 https://newsdata.io/ 获取的API密钥

### 步骤3: 手动测试 GitHub Actions

1. 访问 **Actions** 标签页
2. 点击 **Daily Crypto Report** workflow
3. 点击 **Run workflow** 手动触发一次
4. 检查运行结果

## 📅 自动化调度说明

### 触发时间
- **定时触发**: 每天 UTC 0:00 (北京时间早上8点)
- **手动触发**: 可在 GitHub Actions 页面手动运行

### 执行流程
1. **检出代码**: 获取最新仓库文件
2. **安装依赖**: `npm install`
3. **生成报告**: 运行 `./generate-daily-report.sh --no-git`
4. **提交报告**: 自动提交到 main 分支
5. **上传产物**: 保存报告为 GitHub Actions artifacts

## 📊 数据源优化详情

### 市场数据API (优先级排序)
1. **CryptoPrice API** - 主要数据源
2. **CoinGecko API** - 备用数据源
3. **Coinbase API** - 第三备用源

### 新闻数据源 (5个RSS源)
1. **Cointelegraph** - 领先的加密新闻媒体
2. **CoinDesk** - 专业加密货币新闻
3. **CryptoPotato** - 加密市场分析
4. **NewsBTC** - 比特币和加密新闻
5. **CryptoCoinsNews** - 综合加密新闻

### 比特币数据源
- **Blockchain.info** - 比特币区块链浏览器

## 🔍 监控和维护

### 检查运行状态
1. 访问 **Actions** 标签页
2. 查看最近的运行记录
3. 检查是否有失败的任务

### 查看生成的报告
1. 仓库中的 `en/2026/` 目录 - 英文报告
2. 仓库中的 `zh/2026/` 目录 - 中文报告
3. `data/raw-data.json` - 原始数据

### 故障排除

#### GitHub Actions 失败
- 检查 **Actions** 日志查看具体错误
- 确保 `package.json` 中的依赖正确
- 验证网络连接是否正常

#### 数据获取失败
- 检查 API 服务是否可用
- 查看 `data/raw-data.json` 中的错误信息
- 系统会自动使用备用数据源

#### 推送失败
- 检查 GitHub 仓库权限
- 确认分支保护规则
- 查看 Actions 日志中的具体错误

## 📈 扩展功能建议

### 1. 添加更多数据源
- 考虑添加更多免费的加密API
- 增加去中心化交易所数据
- 添加链上数据分析

### 2. 优化报告格式
- 添加图表和可视化
- 支持更多语言
- 自定义报告模板

### 3. 高级功能
- 价格预警系统
- 社交媒体集成
- 邮件推送通知

## 🎯 下一步操作

1. **验证部署**: 访问 GitHub Actions 查看运行状态
2. **测试自动化**: 手动触发一次工作流
3. **监控运行**: 检查明天的自动运行是否成功
4. **优化配置**: 根据运行情况调整 API 优先级

## 📞 获取帮助

- **查看日志**: GitHub Actions → Daily Crypto Report → 点击具体运行
- **检查报告**: 仓库中的 `en/2026/` 和 `zh/2026/` 目录
- **查看数据**: `data/raw-data.json` 文件

---

**部署完成！** 系统现在每天会自动生成加密资讯日报并提交到仓库。