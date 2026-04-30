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

// Translation cache to avoid repeated API calls
const translationCache = new Map();

/**
 * Translate text from English to Chinese using MyMemory API (free, no auth required)
 */
async function translateToChinese(text) {
  if (!text || text.trim() === '') return text;

  // Check cache first
  const cacheKey = text.substring(0, 100);
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  // Skip translation for very short or numeric-only text
  if (text.length < 3 || /^[0-9\s.,%$]+$/.test(text)) {
    return text;
  }

  // For short texts, translate directly
  if (text.length <= 500) {
    try {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`,
        { timeout: 10000 }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.responseStatus === 200 && result.responseData?.translatedText) {
          const translated = result.responseData.translatedText;
          translationCache.set(cacheKey, translated);
          return translated;
        }
      }
    } catch (error) {
      console.warn('Translation failed:', error.message);
    }
    return text;
  }

  // For longer texts, split into sentences and translate each
  try {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const translatedSentences = [];

    for (const sentence of sentences) {
      if (sentence.trim().length < 3) {
        translatedSentences.push(sentence);
        continue;
      }

      // Translate each sentence
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(sentence.trim())}&langpair=en|zh-CN`,
        { timeout: 10000 }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.responseStatus === 200 && result.responseData?.translatedText) {
          translatedSentences.push(result.responseData.translatedText);
        } else {
          translatedSentences.push(sentence);
        }
      } else {
        translatedSentences.push(sentence);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const translated = translatedSentences.join(' ');
    translationCache.set(cacheKey, translated);
    return translated;
  } catch (error) {
    console.warn('Translation failed:', error.message);
    return text;
  }
}

/**
 * Translate all news articles to Chinese
 */
async function translateNews(news) {
  const translatedNews = [];

  for (const article of news) {
    const translated = {
      ...article,
      title: await translateToChinese(article.title),
      description: await translateToChinese(stripHtml(article.description))
    };
    translatedNews.push(translated);

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return translatedNews;
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 1000); // Limit length to save tokens
}

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
  const sentiment = data.sentiment || {};
  const fearGreed = data.fearGreed;

  let report = `# CryptoPulse Daily Report\n`;
  report += `## ${date}\n\n`;

  report += `**Report generated:** ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC\n`;
  report += `**Data sources:** ${data.sources?.join(', ') || 'Multiple'}\n\n`;

  // Daily Summary Section
  report += `## Daily Summary\n\n`;

  // Fear & Greed Index
  if (fearGreed) {
    const emoji = fearGreed.value <= 20 ? '😱' : fearGreed.value <= 40 ? '😰' : fearGreed.value <= 60 ? '😐' : fearGreed.value <= 80 ? '😊' : '🤑';
    report += `**Fear & Greed Index:** ${emoji} ${fearGreed.value}/100 (${fearGreed.classification})\n\n`;
  }

  // Market Sentiment
  if (sentiment.trend) {
    const trendEmoji = {
      bullish: '📈',
      bearish: '📉',
      slightly_bullish: '📊',
      slightly_bearish: '📊',
      sideways: '➡️'
    };
    report += `**Market Trend:** ${trendEmoji[sentiment.trend] || '➡️'} ${sentiment.trend.replace('_', ' ').toUpperCase()}\n`;
  }

  if (sentiment.outlook) {
    report += `**Outlook:** ${sentiment.outlook}\n`;
  }

  if (sentiment.keyFactors && sentiment.keyFactors.length > 0) {
    report += `\n**Key Factors:**\n`;
    sentiment.keyFactors.forEach(factor => {
      report += `- ${factor}\n`;
    });
  }

  report += `\n---\n\n`;

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
async function generateChineseReport(data, date) {
  const cryptos = data.cryptocurrencies || [];
  let news = data.news || [];
  const sentiment = data.sentiment || {};
  const fearGreed = data.fearGreed;

  // Translate news to Chinese
  if (news.length > 0) {
    console.log('Translating news to Chinese...');
    news = await translateNews(news);
  }

  let report = `# CryptoPulse 每日报告\n`;
  report += `## ${date}\n\n`;

  report += `**报告生成时间：** ${new Date().toLocaleString('zh-CN', { timeZone: 'UTC' })} UTC\n`;
  report += `**数据来源：** ${data.sources?.join('、') || '多个'}\n\n`;

  // Daily Summary Section
  report += `## 每日市场总结\n\n`;

  // Fear & Greed Index
  if (fearGreed) {
    const emoji = fearGreed.value <= 20 ? '😱' : fearGreed.value <= 40 ? '😰' : fearGreed.value <= 60 ? '😐' : fearGreed.value <= 80 ? '😊' : '🤑';
    const classificationCN = {
      'Extreme Fear': '极度恐慌',
      'Fear': '恐慌',
      'Neutral': '中性',
      'Greed': '贪婪',
      'Extreme Greed': '极度贪婪'
    };
    report += `**市场恐慌指数：** ${emoji} ${fearGreed.value}/100 (${classificationCN[fearGreed.classification] || fearGreed.classification})\n\n`;
  }

  // Market Sentiment
  const trendMapCN = {
    bullish: '上涨趋势',
    bearish: '下跌趋势',
    slightly_bullish: '小幅上涨',
    slightly_bearish: '小幅下跌',
    sideways: '横盘整理'
  };

  if (sentiment.trend) {
    const trendEmoji = {
      bullish: '📈',
      bearish: '📉',
      slightly_bullish: '📊',
      slightly_bearish: '📊',
      sideways: '➡️'
    };
    report += `**市场趋势：** ${trendEmoji[sentiment.trend] || '➡️'} ${trendMapCN[sentiment.trend] || sentiment.trend}\n`;
  }

  if (sentiment.outlook) {
    report += `**市场展望：** ${sentiment.outlook}\n`;
  }

  if (sentiment.keyFactors && sentiment.keyFactors.length > 0) {
    report += `\n**关键因素：**\n`;
    sentiment.keyFactors.forEach(factor => {
      report += `- ${factor}\n`;
    });
  }

  report += `\n---\n\n`;

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
    const chineseReport = await generateChineseReport(data, dateDisplay);

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