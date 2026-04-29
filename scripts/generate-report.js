#!/usr/bin/env node

/**
 * CryptoPulse Report Generator
 * Generates bilingual daily reports from fetched data
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const EN_DIR = path.join(__dirname, '..', 'en', '2026');
const ZH_DIR = path.join(__dirname, '..', 'zh', '2026');
const DATA_FILE = path.join(DATA_DIR, 'raw-data.json');

// Ensure directories exist
[EN_DIR, ZH_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Format currency with commas
 */
function formatCurrency(num) {
  if (num === null || num === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

/**
 * Format large numbers with abbreviations
 */
function formatLargeNumber(num) {
  if (num === null || num === undefined) return 'N/A';

  if (num >= 1e12) {
    return `$${(num / 1e12).toFixed(2)}T`;
  } else if (num >= 1e9) {
    return `$${(num / 1e9).toFixed(2)}B`;
  } else if (num >= 1e6) {
    return `$${(num / 1e6).toFixed(2)}M`;
  } else if (num >= 1e3) {
    return `$${(num / 1e3).toFixed(2)}K`;
  }
  return formatCurrency(num);
}

/**
 * Generate English report
 */
function generateEnglishReport(data, date) {
  const cryptos = data.cryptocurrencies || [];
  const news = data.news || [];

  let report = `# CryptoPulse Daily Report\n`;
  report += `## ${date}\n\n`;

  report += `**Report generated:** ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC\n`;
  report += `**Data sources:** ${data.sources?.join(', ') || 'Multiple'}\n\n`;

  // Market Overview Section
  report += `## Market Overview\n\n`;

  if (cryptos.length > 0) {
    report += `| Rank | Symbol | Name | Price | 24h Change | Market Cap |\n`;
    report += `|------|--------|------|-------|------------|------------|\n`;

    cryptos.slice(0, 10).forEach((coin, index) => {
      const changeClass = coin.priceChange24h >= 0 ? '🟢' : '🔴';
      const changeSign = coin.priceChange24h >= 0 ? '+' : '';

      report += `| ${index + 1} | ${coin.symbol} | ${coin.name} | ${formatCurrency(coin.price)} | ${changeClass} ${changeSign}${coin.priceChange24h?.toFixed(2)}% | ${formatLargeNumber(coin.marketCap)} |\n`;
    });

    report += `\n`;
  } else {
    report += `*No market data available*\n\n`;
  }

  // Bitcoin Section
  if (data.bitcoin) {
    report += `## Bitcoin (BTC) Highlights\n\n`;
    report += `- **Current Price:** ${formatCurrency(data.bitcoin.price)}\n`;
    report += `- **24h High:** ${formatCurrency(data.bitcoin.high24h)}\n`;
    report += `- **24h Low:** ${formatCurrency(data.bitcoin.low24h)}\n`;
    report += `- **24h Volume:** ${formatLargeNumber(data.bitcoin.volume24h)}\n\n`;
  }

  // News Section
  if (news.length > 0) {
    report += `## Latest News\n\n`;

    news.slice(0, 5).forEach((article, index) => {
      const date = new Date(article.publishedAt);
      const dateStr = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      report += `### ${index + 1}. ${article.title}\n\n`;
      report += `**Source:** ${article.source} | **Published:** ${dateStr}\n\n`;
      report += `${article.description}\n\n`;
      report += `[Read more](${article.url})\n\n`;
    });
  } else {
    report += `## Latest News\n\n`;
    report += `*No news articles available*\n\n`;
  }

  // Disclaimer
  report += `---\n\n`;
  report += `*Disclaimer: This report is generated automatically and should not be considered financial advice. Always do your own research before making investment decisions.*\n`;

  return report;
}

/**
 * Generate Chinese report
 */
function generateChineseReport(data, date) {
  const cryptos = data.cryptocurrencies || [];
  const news = data.news || [];

  let report = `# CryptoPulse 每日报告\n`;
  report += `## ${date}\n\n`;

  report += `**报告生成时间：** ${new Date().toLocaleString('zh-CN', { timeZone: 'UTC' })} UTC\n`;
  report += `**数据来源：** ${data.sources?.join('、') || '多个'}\n\n`;

  // Market Overview Section
  report += `## 市场概览\n\n`;

  if (cryptos.length > 0) {
    report += `| 排名 | 代币 | 名称 | 价格 | 24小时涨跌 | 市值 |\n`;
    report += `|------|------|------|------|------------|------|\n`;

    cryptos.slice(0, 10).forEach((coin, index) => {
      const changeClass = coin.priceChange24h >= 0 ? '🟢' : '🔴';
      const changeSign = coin.priceChange24h >= 0 ? '+' : '';

      report += `| ${index + 1} | ${coin.symbol} | ${coin.name} | ${formatCurrency(coin.price)} | ${changeClass} ${changeSign}${coin.priceChange24h?.toFixed(2)}% | ${formatLargeNumber(coin.marketCap)} |\n`;
    });

    report += `\n`;
  } else {
    report += `*暂无市场数据*\n\n`;
  }

  // Bitcoin Section
  if (data.bitcoin) {
    report += `## 比特币 (BTC) 重点\n\n`;
    report += `- **当前价格：** ${formatCurrency(data.bitcoin.price)}\n`;
    report += `- **24小时最高：** ${formatCurrency(data.bitcoin.high24h)}\n`;
    report += `- **24小时最低：** ${formatCurrency(data.bitcoin.low24h)}\n`;
    report += `- **24小时成交量：** ${formatLargeNumber(data.bitcoin.volume24h)}\n\n`;
  }

  // News Section
  if (news.length > 0) {
    report += `## 最新资讯\n\n`;

    news.slice(0, 5).forEach((article, index) => {
      const date = new Date(article.publishedAt);
      const dateStr = date.toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      report += `### ${index + 1}. ${article.title}\n\n`;
      report += `**来源：** ${article.source} | **发布时间：** ${dateStr}\n\n`;
      report += `${article.description}\n\n`;
      report += `[阅读更多](${article.url})\n\n`;
    });
  } else {
    report += `## 最新资讯\n\n`;
    report += `*暂无新闻文章*\n\n`;
  }

  // Disclaimer
  report += `---\n\n`;
  report += `*免责声明：本报告自动生成，不应视为投资建议。投资前请务必自行研究。*\n`;

  return report;
}

/**
 * Main function to generate reports
 */
async function main() {
  console.log('=== CryptoPulse Report Generator ===');
  console.log('Date:', new Date().toISOString());
  console.log('');

  try {
    // Check if data file exists
    if (!fs.existsSync(DATA_FILE)) {
      console.error('✗ Data file not found:', DATA_FILE);
      return false;
    }

    // Read data
    const rawData = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(rawData);

    // Get today's date for filename
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const dateDisplay = today.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Generate reports
    console.log('Generating English report...');
    const englishReport = generateEnglishReport(data, dateDisplay);

    console.log('Generating Chinese report...');
    const chineseReport = generateChineseReport(data, dateDisplay);

    // Save reports
    const enFile = path.join(EN_DIR, `${dateStr}.md`);
    const zhFile = path.join(ZH_DIR, `${dateStr}.md`);

    fs.writeFileSync(enFile, englishReport);
    fs.writeFileSync(zhFile, chineseReport);

    console.log('');
    console.log('✓ Reports generated successfully!');
    console.log(`✓ English: ${enFile}`);
    console.log(`✓ Chinese: ${zhFile}`);
    console.log(`✓ Data timestamp: ${data.timestamp}`);

    return true;
  } catch (error) {
    console.error('✗ Report generation failed:', error.message);
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  main().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { main, generateEnglishReport, generateChineseReport };