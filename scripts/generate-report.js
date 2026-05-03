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
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 1000);
}

/**
 * Format large numbers with abbreviations
 */
function formatCompact(num) {
  if (num === null || num === undefined || num === 0) return 'N/A';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toString();
}

/**
 * Format difficulty for readability
 */
function formatDifficulty(d) {
  if (d === null || d === undefined) return 'N/A';
  if (d >= 1e12) return (d / 1e12).toFixed(2) + ' T';
  if (d >= 1e9) return (d / 1e9).toFixed(2) + ' G';
  return d.toLocaleString();
}

/**
 * Generate AI summary for market analysis
 */
function generateAISummary(data) {
  const cryptos = data.cryptocurrencies || [];
  const sentiment = data.sentiment || {};
  const globalMarket = data.globalMarket || {};
  const defiTvl = data.defiTvl || {};
  const btcOnchain = data.bitcoinOnchain || {};

  const btc = cryptos.find(c => c.symbol === 'BTC');
  const eth = cryptos.find(c => c.symbol === 'ETH');
  const topGainers = [...cryptos].sort((a, b) => b.priceChange24h - a.priceChange24h).slice(0, 3);
  const topLosers = [...cryptos].sort((a, b) => a.priceChange24h - b.priceChange24h).slice(0, 3);

  const btcDominance = globalMarket.btcDominance || 0;
  const totalMcap = globalMarket.totalMarketCap || 0;

  const btcPrice = btc?.price || 0;
  const btcChange = btc?.priceChange24h || 0;
  const ethPrice = eth?.price || 0;
  const ethChange = eth?.priceChange24h || 0;

  let summary = '';

  // Overall assessment
  if (sentiment.trend === 'bullish' && btcChange > 1) {
    summary += '🚀 比特币强势领涨，市场做多情绪浓厚。';
  } else if (sentiment.trend === 'bearish' && btcChange < -1) {
    summary += '⚠️ 市场回调风险上升，建议关注关键支撑位。';
  } else if (Math.abs(btcChange) < 0.5) {
    summary += '📊 市场进入盘整阶段，方向选择临近。';
  } else {
    summary += '📈 市场温和反弹，观望情绪占主导。';
  }

  // BTC performance
  if (btcPrice > 75000) {
    summary += `\n• 比特币站稳 ${(btcPrice / 1000).toFixed(1)}k 关口，${btcChange > 0 ? '强势' : '承压'} 状态；`;
  } else {
    summary += `\n• 比特币回调至 ${(btcPrice / 1000).toFixed(1)}k，需警惕进一步下行风险；`;
  }

  // ETH联动
  if (ethPrice > 0 && btcPrice > 0) {
    const ratio = ethPrice / btcPrice * 10000;
    summary += `\n• ETH/BTC 比率 ${ratio.toFixed(2)}，${ratio > 30 ? 'ETH 相对强势' : 'BTC 主导市场'}；`;
  }

  // DeFi
  if (defiTvl.totalTvl > 0) {
    const tvlB = defiTvl.totalTvl / 1e9;
    summary += `\n• DeFi 锁仓量 ${tvlB.toFixed(0)}B，${defiTvl.change24h > 0 ? '连续流入' : '小幅流出'}；`;
  }

  // 热点币种
  if (topGainers.length > 0 && topGainers[0].priceChange24h > 5) {
    summary += `\n• 今日明星：${topGainers[0].symbol} +${topGainers[0].priceChange24h.toFixed(1)}%；`;
  }

  // BTC Dominance
  if (btcDominance > 60) {
    summary += `\n• BTC 主导地位强化（${btcDominance.toFixed(1)}%），资金集中头部；`;
  } else if (btcDominance < 50) {
    summary += `\n• 市场轮动明显，ALT 季节进行中；`;
  }

  // On-chain signal
  if (btcOnchain.hashRate > 0) {
    summary += `\n• 算力 ${btcOnchain.hashRate.toFixed(0)} EH/s，矿工信心充足；`;
  }

  return summary;
}

/**
 * Generate AI summary for English report
 */
function generateAISummaryEnglish(data) {
  const cryptos = data.cryptocurrencies || [];
  const sentiment = data.sentiment || {};
  const globalMarket = data.globalMarket || {};
  const defiTvl = data.defiTvl || {};
  const btcOnchain = data.bitcoinOnchain || {};

  const btc = cryptos.find(c => c.symbol === 'BTC');
  const eth = cryptos.find(c => c.symbol === 'ETH');
  const topGainers = [...cryptos].sort((a, b) => b.priceChange24h - a.priceChange24h).slice(0, 3);

  const btcDominance = globalMarket.btcDominance || 0;

  const btcPrice = btc?.price || 0;
  const btcChange = btc?.priceChange24h || 0;
  const ethPrice = eth?.price || 0;
  const ethChange = eth?.priceChange24h || 0;

  let summary = '';

  if (sentiment.trend === 'bullish' && btcChange > 1) {
    summary += '🚀 Bitcoin surges, strong bullish sentiment.';
  } else if (sentiment.trend === 'bearish' && btcChange < -1) {
    summary += '⚠️ Market correction risk rising, watch key support levels.';
  } else if (Math.abs(btcChange) < 0.5) {
    summary += '📊 Market consolidating, direction choice imminent.';
  } else {
    summary += '📈 Mild rebound, caution prevails.';
  }

  if (btcPrice > 75000) {
    summary += `\n• Bitcoin holds above ${(btcPrice / 1000).toFixed(1)}k, ${btcChange > 0 ? 'strong' : 'under pressure'};`;
  }

  if (ethPrice > 0 && btcPrice > 0) {
    const ratio = ethPrice / btcPrice * 10000;
    summary += `\n• ETH/BTC ratio ${ratio.toFixed(2)}, ${ratio > 30 ? 'ETH outperformance' : 'BTC dominance'};`;
  }

  if (defiTvl.totalTvl > 0) {
    const tvlB = defiTvl.totalTvl / 1e9;
    summary += `\n• DeFi TVL $${tvlB.toFixed(0)}B, ${defiTvl.change24h > 0 ? 'inflows continuing' : 'slight outflows'};`;
  }

  if (topGainers.length > 0 && topGainers[0].priceChange24h > 5) {
    summary += `\n• Top gainer: ${topGainers[0].symbol} +${topGainers[0].priceChange24h.toFixed(1)}%;`;
  }

  if (btcDominance > 60) {
    summary += `\n• BTC dominance strengthening (${btcDominance.toFixed(1)}%), capital concentrated;`;
  } else if (btcDominance < 50) {
    summary += `\n• Market rotating, alt season in progress;`;
  }

  if (btcOnchain.hashRate > 0) {
    summary += `\n• Hash rate ${btcOnchain.hashRate.toFixed(0)} EH/s, miner confidence high;`;
  }

  return summary;
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
      cautiously_bullish: '📊',
      sideways: '➡️',
      cautiously_bearish: '📊',
      bearish: '📉'
    };
    report += `**Market Trend:** ${trendEmoji[sentiment.trend] || '➡️'} ${sentiment.trend.replace('_', ' ').toUpperCase()}\n`;
  }

  if (sentiment.outlookEn) {
    report += `**Outlook:** ${sentiment.outlookEn}\n`;
  }

  if (sentiment.keyFactors && sentiment.keyFactors.length > 0) {
    report += `\n**Key Factors:**\n`;
    sentiment.keyFactors.forEach(factor => {
      report += `- ${factor}\n`;
    });
  }

  report += `\n---\n\n`;

  // AI Market Analysis
  const aiSummary = generateAISummaryEnglish(data);
  if (aiSummary) {
    report += `## AI Market Analysis\n\n${aiSummary}\n\n---\n\n`;
  }

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
    report += `- **24h Volume:** ${formatLargeNumber(data.bitcoin.volume24h)}\n`;

    if (data.bitcoin.priceYesterday) {
      const diff = data.bitcoin.price - data.bitcoin.priceYesterday;
      const pct = (diff / data.bitcoin.priceYesterday) * 100;
      const sign = diff >= 0 ? '+' : '';
      report += `- **vs Yesterday:** ${formatCurrency(data.bitcoin.priceYesterday)} → ${formatCurrency(data.bitcoin.price)} (${sign}${diff.toFixed(2)} / ${sign}${pct.toFixed(2)}%)\n`;
    }

    report += `\n`;
  }

  // Bitcoin On-Chain Metrics
  if (data.bitcoinOnchain) {
    const b = data.bitcoinOnchain;
    const activeAddrStr = b.activeAddresses != null ? b.activeAddresses.toLocaleString() : 'N/A';
    report += `## Bitcoin On-Chain Metrics\n\n`;
    report += `- **Active Addresses:** ${activeAddrStr}\n`;
    report += `- **Transactions:** ${b.transactionCount.toLocaleString()}\n`;
    report += `- **Hash Rate:** ${b.hashRate != null ? b.hashRate.toFixed(2) + ' EH/s' : 'N/A'}\n`;
    report += `- **Difficulty:** ${formatDifficulty(b.difficulty)}\n\n`;
  }

  // DeFi Market
  if (data.defiTvl) {
    const defi = data.defiTvl;
    const totalTvlB = (typeof defi.totalTvl === 'number') ? (defi.totalTvl / 1e9) : 0;
    const topProtocols = Array.isArray(defi.topProtocols) ? defi.topProtocols : [];
    report += `## DeFi Market\n\n`;
    report += `- **Total TVL:** $${totalTvlB.toFixed(2)} B\n`;
    report += `- **24h Change:** ${defi.change24h >= 0 ? '+' : ''}${defi.change24h.toFixed(2)}%\n`;
    if (topProtocols.length > 0) {
      report += `- **Top Protocols:**\n`;
      topProtocols.forEach(p => {
        const pv = (p.tvl / 1e9) || 0;
        const sign = (p.change24h ?? 0) >= 0 ? '+' : '';
        report += `  - ${p.name}: $${pv.toFixed(2)} B (${sign}${(p.change24h ?? 0).toFixed(2)}%)\n`;
      });
    }
report += `\n`;
  }

  // Global Market Section
  if (data.globalMarket) {
    const gm = data.globalMarket;
    const totalMcapT = (gm.totalMarketCap >= 1e12) ? (gm.totalMarketCap / 1e12).toFixed(2) : (gm.totalMarketCap / 1e9).toFixed(2);
    const mcapUnit = gm.totalMarketCap >= 1e12 ? 'T' : 'B';
    report += `## Global Market\n\n`;
    report += `- **Total Market Cap:** $${totalMcapT}${mcapUnit}\n`;
    report += `- **24h Change:** ${gm.marketCapChange24h >= 0 ? '+' : ''}${gm.marketCapChange24h.toFixed(2)}%\n`;
    report += `- **BTC Dominance:** ${gm.btcDominance.toFixed(2)}%\n`;
    report += `- **ETH Dominance:** ${gm.ethDominance.toFixed(2)}%\n\n`;
  }

  // Bitcoin Section
  if (data.bitcoin) {
    report += `## 比特币 (BTC) 重点\n\n`;
    report += `- **当前价格：** ${formatCurrency(data.bitcoin.price)}\n`;
    report += `- **24小时最高：** ${formatCurrency(data.bitcoin.high24h)}\n`;
    report += `- **24小时最低：** ${formatCurrency(data.bitcoin.low24h)}\n`;
    report += `- **24小时成交量：** ${formatLargeNumber(data.bitcoin.volume24h)}\n`;

    if (data.bitcoin.priceYesterday) {
      const diff = data.bitcoin.price - data.bitcoin.priceYesterday;
      const pct = (diff / data.bitcoin.priceYesterday) * 100;
      const sign = diff >= 0 ? '+' : '';
      report += `- **vs 昨日：** ${formatCurrency(data.bitcoin.priceYesterday)} → ${formatCurrency(data.bitcoin.price)} (${sign}${diff.toFixed(2)} / ${sign}${pct.toFixed(2)}%)\n`;
    }

    report += `\n`;
  }

  // DeFi Market
  if (data.defiTvl) {
    const defi = data.defiTvl;
    const totalTvlB = (typeof defi.totalTvl === 'number') ? (defi.totalTvl / 1e9) : 0;
    const topProtocols = Array.isArray(defi.topProtocols) ? defi.topProtocols : [];
    report += `## DeFi 市场\n\n`;
    report += `- **总锁仓量：** $${totalTvlB.toFixed(2)} B\n`;
    report += `- **24小时变化：** ${defi.change24h >= 0 ? '+' : ''}${defi.change24h.toFixed(2)}%\n`;
    if (topProtocols.length > 0) {
      report += `- 头部协议：\n`;
      topProtocols.forEach(p => {
        const pv = (p.tvl / 1e9) || 0;
        const sign = (p.change24h ?? 0) >= 0 ? '+' : '';
        report += `  - ${p.name}: $${pv.toFixed(2)} B (${sign}${(p.change24h ?? 0).toFixed(2)}%)\n`;
      });
    }
    report += `\n`;
  }

  // Bitcoin On-Chain Metrics
  if (data.bitcoinOnchain) {
    const b = data.bitcoinOnchain;
    const activeAddrStr = b.activeAddresses != null ? b.activeAddresses.toLocaleString() : 'N/A';
    report += `## 比特币链上指标\n\n`;
    report += `- 活跃地址数：${activeAddrStr}\n`;
    report += `- 交易笔数：${b.transactionCount.toLocaleString()}\n`;
    report += `- 算力：${b.hashRate != null ? b.hashRate.toFixed(2) + ' EH/s' : 'N/A'}\n`;
    report += `- 难度：${formatDifficulty(b.difficulty)}\n\n`;
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

  // Data freshness
  if (data.timestamp) {
    const ageMinutes = Math.round((Date.now() - new Date(data.timestamp).getTime()) / 60000);
    report += `---\n\n`;
    report += `**Data age:** ~${ageMinutes} minutes ago\n`;
  }

  // Disclaimer
  report += `---\n\n`;
  report += `*Disclaimer: This report is auto-generated and should not be considered investment advice. Always do your own research before investing.*\n`;

  return report;
}

/**
 * Generate Chinese report
 */
async function generateChineseReport(data, date) {
  const cryptos = data.cryptocurrencies || [];
  const news = data.news || [];
  const sentiment = data.sentiment || {};
  const fearGreed = data.fearGreed;

  // Translate news to Chinese
  const translatedNews = await translateNews(news);

  let report = `# CryptoPulse 每日报告\n`;
  report += `## ${date}\n\n`;

  report += `**报告生成时间：** ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} 北京时间\n`;
  report += `**数据来源：** ${data.sources?.join('、') || '多个来源'}\n\n`;

  // Fear & Greed Index
  if (fearGreed) {
    const emoji = fearGreed.value <= 20 ? '😱' : fearGreed.value <= 40 ? '😰' : fearGreed.value <= 60 ? '😐' : fearGreed.value <= 80 ? '😊' : '🤑';
    report += `**恐惧与贪婪指数：** ${emoji} ${fearGreed.value}/100 (${fearGreed.classification})\n\n`;
  }

  // Market Sentiment
  if (sentiment.trend) {
    const trendEmoji = {
      bullish: '📈',
      cautiously_bullish: '📊',
      sideways: '➡️',
      cautiously_bearish: '📊',
      bearish: '📉'
    };
    const trendMap = {
      bullish: '看涨',
      cautiously_bullish: '谨慎看涨',
      sideways: '横盘',
      cautiously_bearish: '谨慎看跌',
      bearish: '看跌'
    };
    report += `**市场趋势：** ${trendEmoji[sentiment.trend] || '➡️'} ${trendMap[sentiment.trend] || sentiment.trend}\n`;
  }

  if (sentiment.outlook) {
    report += `**市场展望：** ${sentiment.outlook}\n`;
  }

  if (sentiment.keyFactorsZh && sentiment.keyFactorsZh.length > 0) {
    report += `\n**关键因素：**\n`;
    for (const factor of sentiment.keyFactorsZh) {
      report += `- ${factor}\n`;
    }
  }

  report += `\n---\n\n`;

  // AI Market Analysis
  const aiSummary = generateAISummary(data);
  if (aiSummary) {
    report += `## AI 市场分析\n\n${aiSummary}\n\n---\n\n`;
  }

  // Market Overview
  report += `## 市场概览\n\n`;

  if (cryptos.length > 0) {
    report += `| 排名 | 代币 | 名称 | 价格 | 24小时涨跌 | 市值 |\n`;
    report += `|------|------|------|-------|------------|------|\n`;

    cryptos.slice(0, 10).forEach((coin, index) => {
      const changeClass = coin.priceChange24h >= 0 ? '🟢' : '🔴';
      const changeSign = coin.priceChange24h >= 0 ? '+' : '';
      const name = coin.nameCn || coin.name;
      report += `| ${index + 1} | ${coin.symbol} | ${name} | ${formatCurrency(coin.price)} | ${changeClass} ${changeSign}${coin.priceChange24h?.toFixed(2)}% | ${formatLargeNumber(coin.marketCap)} |\n`;
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
    report += `- **24小时成交量：** ${formatLargeNumber(data.bitcoin.volume24h)}\n`;

    if (data.bitcoin.priceYesterday) {
      const diff = data.bitcoin.price - data.bitcoin.priceYesterday;
      const pct = (diff / data.bitcoin.priceYesterday) * 100;
      const sign = diff >= 0 ? '+' : '';
      report += `- **vs 昨日：** ${formatCurrency(data.bitcoin.priceYesterday)} → ${formatCurrency(data.bitcoin.price)} (${sign}${diff.toFixed(2)} / ${sign}${pct.toFixed(2)}%)\n`;
    }

    report += `\n`;
  }

  // Bitcoin On-Chain Metrics
  if (data.bitcoinOnchain) {
    const b = data.bitcoinOnchain;
    const activeAddrStr = b.activeAddresses != null ? b.activeAddresses.toLocaleString() : 'N/A';
    report += `## 比特币链上指标\n\n`;
    report += `- **活跃地址数：** ${activeAddrStr}\n`;
    report += `- **交易笔数：** ${b.transactionCount.toLocaleString()}\n`;
    report += `- **算力：** ${b.hashRate != null ? b.hashRate.toFixed(2) + ' EH/s' : 'N/A'}\n`;
    report += `- **难度：** ${formatDifficulty(b.difficulty)}\n\n`;
  }

  // DeFi Market
  if (data.defiTvl) {
    const defi = data.defiTvl;
    const totalTvlB = (typeof defi.totalTvl === 'number') ? (defi.totalTvl / 1e9) : 0;
    const topProtocols = Array.isArray(defi.topProtocols) ? defi.topProtocols : [];
    report += `## DeFi 市场\n\n`;
    report += `- **总锁仓量：** $${totalTvlB.toFixed(2)} B\n`;
    report += `- **24小时变化：** ${defi.change24h >= 0 ? '+' : ''}${defi.change24h.toFixed(2)}%\n`;
    if (topProtocols.length > 0) {
      report += `- **头部协议：**\n`;
      topProtocols.forEach(p => {
        const pv = (p.tvl / 1e9) || 0;
        const sign = (p.change24h ?? 0) >= 0 ? '+' : '';
        report += `  - ${p.name}: $${pv.toFixed(2)} B (${sign}${(p.change24h ?? 0).toFixed(2)}%)\n`;
      });
    }
    report += `\n`;
  }

  // Global Market
  if (data.globalMarket) {
    const gm = data.globalMarket;
    const totalMcapT = (gm.totalMarketCap >= 1e12) ? (gm.totalMarketCap / 1e12).toFixed(2) : (gm.totalMarketCap / 1e9).toFixed(2);
    const mcapUnit = gm.totalMarketCap >= 1e12 ? 'T' : 'B';
    report += `## 全球市场\n\n`;
    report += `- **总市值：** $${totalMcapT}${mcapUnit}\n`;
    report += `- **24小时变化：** ${gm.marketCapChange24h >= 0 ? '+' : ''}${gm.marketCapChange24h.toFixed(2)}%\n`;
    report += `- **BTC 占比：** ${gm.btcDominance.toFixed(2)}%\n`;
    report += `- **ETH 占比：** ${gm.ethDominance.toFixed(2)}%\n\n`;
  }

  // News Section
  if (translatedNews.length > 0) {
    report += `## 最新资讯\n\n`;

    translatedNews.slice(0, 5).forEach((article, index) => {
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

  // Data freshness
  if (data.timestamp) {
    const ageMinutes = Math.round((Date.now() - new Date(data.timestamp).getTime()) / 60000);
    report += `---\n\n`;
    report += `**数据时效：** 约 ${ageMinutes} 分钟前更新\n`;
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
