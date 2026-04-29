# CryptoPulse API 配置指南

## 📋 API 使用情况

| API | 用途 | 状态 | 费用 |
|-----|------|------|------|
| CoinGecko | 加密货币市场数据 | ✅ 已配置 | 免费 (50次/分钟) |
| Blockchain.info | 比特币数据 | ✅ 已配置 | 免费 |
| NewsData.io | 加密货币新闻 | ⚠️ 需要配置 | 免费 (1000次/天) |

## 🔑 获取 API 密钥

### 1. NewsData.io API (必需)

**步骤：**
1. 访问 [https://newsdata.io/](https://newsdata.io/)
2. 点击 "Register" 注册账户
3. 验证邮箱
4. 登录后在 Dashboard 获取 API 密钥
5. 免费套餐：1000次请求/天

**配置：**
将获取的密钥添加到 `.env` 文件：
```bash
NEWSDATA_API_KEY=your_api_key_here
```

### 2. CoinGecko API (可选)

**说明：**
- 免费版已足够使用 (50次/分钟)
- 如需更高限额，可注册专业版
- 当前代码已配置免费端点

### 3. Blockchain.info API (可选)

**说明：**
- 完全免费，无需密钥
- 提供比特币实时数据

## 📝 配置文件示例

创建 `.env` 文件（已在项目中创建）：

```bash
# NewsData.io API 密钥 (必需)
NEWSDATA_API_KEY=your_api_key_here

# 可选：其他API配置
# COINGECKO_API_KEY=your_coingecko_pro_key
# BLOCKCHAIN_INFO_API_KEY=your_blockchain_info_key
```

## 🚀 测试配置

### 1. 测试数据获取
```bash
npm run fetch
```

### 2. 生成报告
```bash
npm run generate
```

### 3. 完整流程
```bash
./generate-daily-report.sh --no-git
```

## ⚠️ 常见问题

### 问题1：API 密钥无效
**解决方案：**
- 检查 `.env` 文件路径是否正确
- 确认密钥没有空格或换行符
- 重启终端或重新加载环境变量

### 问题2：请求次数超限
**解决方案：**
- NewsData.io 免费版每天1000次请求
- 如需更多请求，考虑升级套餐
- 或使用多个API密钥轮换

### 问题3：网络连接问题
**解决方案：**
- 检查网络连接
- 确认防火墙没有阻止API请求
- 尝试使用VPN

## 🔒 安全建议

1. **不要提交 `.env` 文件到Git**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **使用环境变量管理密钥**
   - 本地开发：使用 `.env` 文件
   - 生产环境：使用系统环境变量
   - CI/CD：使用Secrets

3. **定期轮换API密钥**
   - 每3-6个月更换一次密钥
   - 监控API使用情况

## 📞 API 文档

- **NewsData.io**: [https://newsdata.io/docs](https://newsdata.io/docs)
- **CoinGecko**: [https://www.coingecko.com/en/api](https://www.coingecko.com/en/api)
- **Blockchain.info**: [https://blockchain.info/api](https://blockchain.info/api)

## 🎯 下一步

1. 获取 NewsData.io API 密钥
2. 配置 `.env` 文件
3. 测试数据获取：`npm run fetch`
4. 生成今日报告：`./generate-daily-report.sh --no-git`

配置完成后，系统将自动获取真实数据，不再使用模拟数据！