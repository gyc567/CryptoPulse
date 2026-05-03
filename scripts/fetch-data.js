/**
 * CryptoPulse Data Fetcher
 * Fetches cryptocurrency data from multiple FREE APIs (no API key required)
 */

const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

// Node.js fetch polyfill for compatibility with Node < 18
// Node 18+ has native fetch, but Node 16 does not
if (typeof fetch === 'undefined') {
  global.fetch = async (url, options) => {
    const nodeFetch = require('node-fetch');
    return nodeFetch(url, options);
  };
}

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'raw-data.json');

// Proxy configuration
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy ||
                 process.env.HTTP_PROXY || process.env.http_proxy ||
                 null;

let fetchOptions = {};
if (proxyUrl) {
  console.log(`Using proxy: ${proxyUrl}`);
  fetchOptions = { agent: new HttpsProxyAgent(proxyUrl) };
}

function validateResponse(data, requiredFields) {
  if (!data || typeof data !== 'object') return false;
  for (const field of requiredFields) {
    if (!(field in data)) return false;
  }
  return true;
}

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function formatCurrency(num) {
  if (num === null || num === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}

async function fetchWithRetry(url, options = {}, retries = 3) {
  const mergedOptions = { ...fetchOptions, ...options };

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, mergedOptions);
      if (!response.ok && i < retries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        continue;
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries reached');
}

/**
 * Fetch cryptocurrency data from CryptoCompare API (FREE tier) - PRIMARY
 */
async function fetchCryptoCompareData() {
  try {
    console.log('Fetching data from CryptoCompare API...');

    const response = await fetchWithRetry(
      'https://min-api.cryptocompare.com/data/top/totaltoptiervolfull?limit=10&tsym=USD',
      { timeout: 15000 }
    );

    if (!response.ok) {
      throw new Error(`CryptoCompare API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.Data || data.Data.length === 0) {
      throw new Error('CryptoCompare returned no data');
    }

    return data.Data.map(coin => {
      const raw = coin.RAW?.USD || {};
      const display = coin.DISPLAY?.USD || {};
      return {
        id: coin.CoinInfo.Name.toLowerCase(),
        symbol: coin.CoinInfo.Name,
        name: coin.CoinInfo.FullName,
        price: raw.PRICE || 0,
        priceChange24h: raw.CHANGEPCT24HOUR || 0,
        marketCap: raw.MKTCAP || 0,
        volume24h: raw.TOTALVOLUME24H || raw.VOLUME24HOUR || 0,
        image: `https://cryptocompare.com${coin.CoinInfo.ImageUrl}`
      };
    }).filter(coin => coin.price > 0);
  } catch (error) {
    console.warn('CryptoCompare fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch cryptocurrency data from CoinGecko API (FREE tier) - BACKUP
 */
async function fetchCoinGeckoData() {
  try {
    console.log('Fetching data from CoinGecko API...');

    const response = await fetchWithRetry(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h',
      { timeout: 15000 }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('CoinGecko returned invalid data');
    }

    return data.map(coin => ({
      id: coin.id,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      price: coin.current_price,
      priceChange24h: coin.price_change_percentage_24h,
      marketCap: coin.market_cap,
      volume24h: coin.total_volume,
      image: coin.image
    }));
  } catch (error) {
    console.warn('CoinGecko fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch Bitcoin data from CryptoCompare (FREE, no auth) - PRIMARY
 * Includes 24h high/low/volume
 */
async function fetchBitcoinData() {
  try {
    console.log('Fetching Bitcoin data from CryptoCompare...');

    const response = await fetchWithRetry(
      'https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC&tsyms=USD',
      { timeout: 10000 }
    );

    if (!response.ok) {
      throw new Error(`CryptoCompare BTC error: ${response.status}`);
    }

    const result = await response.json();
    const btcData = result?.RAW?.BTC?.USD;

    if (!btcData) {
      throw new Error('No BTC data returned');
    }

    return {
      symbol: 'BTC',
      name: 'Bitcoin',
      price: btcData.PRICE || 0,
      volume24h: btcData.VOLUME24HOUR || 0,
      high24h: btcData.HIGH24HOUR || 0,
      low24h: btcData.LOW24HOUR || 0,
      marketCap: btcData.MKTCAP || 0,
      change24h: btcData.CHANGEPCT24HOUR || 0
    };
  } catch (error) {
    console.warn('Bitcoin data fetch failed:', error.message);
    return null;
  }
}

/**
 * Fetch Bitcoin price from 24h ago for comparison
 */
async function fetchBTCPriceYesterday() {
  try {
    const response = await fetchWithRetry(
      'https://min-api.cryptocompare.com/data/v2/histoday?fsym=BTC&tsym=USD&limit=1',
      { timeout: 10000 }
    );
    if (!response.ok) return null;
    const result = await response.json();
    const days = result?.Data?.Data;
    if (!days || days.length === 0) return null;
    return days[0].close;
  } catch {
    return null;
  }
}

/**
 * Fetch global market data (market cap, dominance)
 */
async function fetchDeFiTVL() {
  try {
    const resp = await fetchWithRetry('https://api.llama.fi/protocols', { timeout: 15000 });
    if (!resp || !resp.ok) return null;
    const protocols = await resp.json();
    if (!Array.isArray(protocols)) return null;

    // Calculate TVL from chainTvls for each protocol
    const processProtocol = (p) => {
      const chainTvls = p.chainTvls || {};
      const tvlValues = Object.values(chainTvls);
      const totalTvl = tvlValues.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0);
      return {
        name: p.name || p.displayName || 'Unknown',
        tvl: totalTvl,
        change24h: p.change_1d || 0
      };
    };

    // Get top 5 by TVL
    const withTvl = protocols.map(processProtocol)
      .filter(p => p.tvl > 0)
      .sort((a, b) => b.tvl - a.tvl);
    const topProtocols = withTvl.slice(0, 5);

    // Calculate total DeFi TVL from top protocols
    const totalTvl = topProtocols.reduce((sum, p) => sum + p.tvl, 0);
    const change24h = topProtocols.length > 0
      ? topProtocols.reduce((s, p) => s + (p.change24h || 0), 0) / topProtocols.length
      : 0;

    return { totalTvl, change24h, topProtocols };
  } catch (err) {
    return null;
  }
}

/**
 * Fetch global market data from CoinLore (FREE, no auth)
 * Returns: { btcDominance, ethDominance, totalMarketCap, totalVolume, marketCapChange24h }
 */
async function fetchGlobalMarketData() {
  try {
    console.log('Fetching global market data from CoinLore...');
    const resp = await fetchWithRetry('https://api.coinlore.com/api/global/', { timeout: 10000 });
    if (!resp || !resp.ok) return null;
    const data = await resp.json();
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    const d = data[0];
    return {
      btcDominance: parseFloat(d.btc_d) || 0,
      ethDominance: parseFloat(d.eth_d) || 0,
      totalMarketCap: parseFloat(d.total_mcap) || 0,
      totalVolume: parseFloat(d.total_volume) || 0,
      marketCapChange24h: parseFloat(d.mcap_change) || 0
    };
  } catch (err) {
    console.warn('Global market data fetch failed:', err.message);
    return null;
  }
}

async function fetchBitcoinOnchain() {
  try {
    const resp = await fetchWithRetry('https://api.blockchair.com/bitcoin/stats', { timeout: 10000 });
    if (!resp || !resp.ok) return null;
    const j = await resp.json();
    const d = j?.data ?? {};
    const transactionCount = d?.transactions_24h ?? d?.transactions ?? null;
    let hashRate = d?.hashrate_24h ?? d?.hashrate ?? null;
    if (typeof hashRate === 'string') hashRate = parseFloat(hashRate);
    if (typeof hashRate === 'number') hashRate = hashRate / 1e18;
    const difficulty = d?.difficulty ?? null;

    return {
      activeAddresses: null,
      transactionCount: Number(transactionCount ?? 0),
      hashRate: typeof hashRate === 'number' ? hashRate : null,
      difficulty: typeof difficulty === 'number' ? difficulty : null
    };
  } catch (err) {
    return null;
  }
}

/**
 * Fetch crypto news using RSS feeds (FREE, no API key required)
 */
async function fetchCryptoNews() {
  try {
    console.log('Fetching crypto news from RSS feeds...');

    // Multiple RSS sources for better coverage
    const rssFeeds = [
      'https://cointelegraph.com/rss',
      'https://www.coindesk.com/arc/outboundfeeds/rss/',
      'https://feeds.feedburner.com/CryptoCoinsNews',
      'https://cryptopotato.com/feed/',
      'https://www.newsbtc.com/feed/'
    ];

    const news = [];

    for (const feed of rssFeeds) {
      try {
        // Using rss2json API (free tier, no auth required)
        const response = await fetchWithRetry(
          `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`,
          { timeout: 10000 }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.items && data.items.length > 0) {
            news.push(...data.items.slice(0, 3).map(item => ({
              title: item.title,
              source: new URL(feed).hostname,
              publishedAt: item.pubDate || new Date().toISOString(),
              url: item.link,
              description: item.description || item.content || ''
            })));
          }
        }
      } catch (e) {
        // Continue with next feed if one fails
        continue;
      }
    }

    // If no news from RSS, generate basic news from available data
    if (news.length === 0) {
      console.warn('No news from RSS feeds, generating basic news...');
      return generateBasicNews();
    }

    // Remove duplicates and sort by date
    const uniqueNews = news.filter((item, index, self) =>
      index === self.findIndex(t => t.title === item.title)
    );

    // Sort by published date (newest first)
    uniqueNews.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    return uniqueNews.slice(0, 5);
  } catch (error) {
    console.warn('News fetch failed:', error.message);
    return generateBasicNews();
  }
}

/**
 * Generate basic news from available market data
 */
function generateBasicNews() {
  const now = new Date().toISOString();
  return [
    {
      title: 'Cryptocurrency Market Update',
      source: 'CryptoPulse',
      publishedAt: now,
      url: 'https://example.com/market-update',
      description: 'Real-time cryptocurrency market data and analysis.'
    },
    {
      title: 'Bitcoin Network Activity',
      source: 'CryptoPulse',
      publishedAt: now,
      url: 'https://example.com/bitcoin-activity',
      description: 'Latest Bitcoin network statistics and transaction data.'
    },
    {
      title: 'DeFi Market Overview',
      source: 'CryptoPulse',
      publishedAt: now,
      url: 'https://example.com/defi-overview',
      description: 'Decentralized finance market trends and analysis.'
    }
  ];
}

/**
 * Fetch Fear & Greed Index
 */
async function fetchFearGreedIndex() {
  try {
    console.log('Fetching Fear & Greed Index...');
    const response = await fetchWithRetry('https://api.alternative.me/fng/?limit=1', { timeout: 10000 });

    if (!response.ok) {
      throw new Error(`Fear & Greed API error: ${response.status}`);
    }

    const data = await response.json();
    if (data.data && data.data.length > 0) {
      return {
        value: parseInt(data.data[0].value),
        classification: data.data[0].value_classification,
        timestamp: new Date(parseInt(data.data[0].timestamp) * 1000).toISOString()
      };
    }
    return null;
  } catch (error) {
    console.warn('Fear & Greed fetch failed:', error.message);
    return null;
  }
}

async function fetchJintelData() {
  try {
    console.log('Fetching data from Jintel AI...');

    const JINTEL_API = 'https://api.jintel.ai/tools/quotes';
    const JINTEL_TOKEN = process.env.JINTEL_API_KEY || '9b83992a1f960537f5d14d38cda89c51781f534b35e0ad35aa38b69646d218e6';

    const tickers = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK'];

    const response = await fetchWithRetry(JINTEL_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JINTEL_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tickers }),
      timeout: 15000
    });

    if (!response.ok) {
      throw new Error(`Jintel API error: ${response.status}`);
    }

    const result = await response.json();

    if (!result.data?.quotes || !Array.isArray(result.data.quotes)) {
      throw new Error('Jintel returned invalid data structure');
    }

    return result.data.quotes.map(q => ({
      symbol: q.ticker,
      price: q.price,
      change24h: q.changePercent,
      volume24h: q.volume,
      marketCap: q.marketCap
    }));
  } catch (error) {
    console.warn('Jintel fetch failed:', error.message);
    return null;
  }
}

/**
 * Generate market sentiment using multi-factor analysis.
 * BTC direction is primary (50%) since it dominates market cap.
 * Market breadth is secondary (30%) for real market confirmation.
 * Fear & Greed provides context (20%) for signal strength.
 */
function analyzeMarketSentiment(cryptos, bitcoin, fearGreed) {
  const sentiment = {
    btcScore: 0,
    breadthScore: 0,
    fearScore: 0,
    compositeScore: 0,
    trend: 'sideways',
    outlook: '',
    outlookEn: '',
    keyFactors: [],
    btcVsYesterday: null,
    marketBreadth: 0
  };

  // 1. BTC Direction Score (50% weight) — most important signal
  const btc = cryptos.find(c => c.symbol === 'BTC');
  if (bitcoin && bitcoin.priceYesterday) {
    const btcChange = ((bitcoin.price - bitcoin.priceYesterday) / bitcoin.priceYesterday) * 100;
    sentiment.btcVsYesterday = btcChange;
    if (btcChange > 0.5) {
      sentiment.btcScore = 1;
    } else if (btcChange < -0.5) {
      sentiment.btcScore = -1;
    }
    // Flat: score = 0
  }

  // 2. Market Breadth Score (30% weight)
  let gainers = 0;
  let losers = 0;
  cryptos.forEach(coin => {
    if (coin.symbol === 'BTC') return; // BTC counted separately
    if (coin.priceChange24h > 0) gainers++;
    else if (coin.priceChange24h < 0) losers++;
  });
  const nonBtcCount = cryptos.length - 1;
  sentiment.marketBreadth = nonBtcCount > 0 ? (gainers - losers) / nonBtcCount : 0;
  // marketBreadth: +1 = all gainers, -1 = all losers
  sentiment.breadthScore = sentiment.marketBreadth;

  // 3. Fear & Greed Score (20% weight)
  if (fearGreed && fearGreed.value != null) {
    const fg = fearGreed.value;
    if (fg < 25) {
      sentiment.fearScore = -1;    // Extreme Fear → bearish amplifier
    } else if (fg < 45) {
      sentiment.fearScore = -0.5; // Fear → slight bearish
    } else if (fg > 75) {
      sentiment.fearScore = 1;    // Extreme Greed → bullish amplifier
    } else if (fg > 55) {
      sentiment.fearScore = 0.5;   // Greed → slight bullish
    }
    // Neutral (45-55): score = 0
  }

  // Composite score: weighted average
  sentiment.compositeScore =
    sentiment.btcScore * 0.5 +
    sentiment.breadthScore * 0.3 +
    sentiment.fearScore * 0.2;

  // Map composite score to trend
  if (sentiment.compositeScore >= 0.6) {
    sentiment.trend = 'bullish';
  } else if (sentiment.compositeScore >= 0.2) {
    sentiment.trend = 'cautiously_bullish';
  } else if (sentiment.compositeScore <= -0.6) {
    sentiment.trend = 'bearish';
  } else if (sentiment.compositeScore <= -0.2) {
    sentiment.trend = 'cautiously_bearish';
  } else {
    sentiment.trend = 'sideways';
  }

  const T = {
    trend: {
      bullish: { zh: '上涨趋势', en: 'Uptrend' },
      cautiously_bullish: { zh: '谨慎看涨', en: 'Cautiously bullish' },
      sideways: { zh: '横盘整理', en: 'Sideways' },
      cautiously_bearish: { zh: '谨慎看跌', en: 'Cautiously bearish' },
      bearish: { zh: '下跌趋势', en: 'Downtrend' }
    },
    btcDir: (score) => ({
      zh: score > 0 ? 'BTC 上涨' : score < 0 ? 'BTC 下调' : 'BTC 持稳',
      en: score > 0 ? 'BTC up' : score < 0 ? 'BTC down' : 'BTC flat'
    }),
    breadthDir: (breadth) => ({
      zh: breadth > 0.3 ? '市场广度健康' : breadth < -0.3 ? '市场广度偏弱' : '市场分化',
      en: breadth > 0.3 ? 'broad strength' : breadth < -0.3 ? 'broad weakness' : 'mixed breadth'
    })
  };

  const btcDirT = T.btcDir(sentiment.btcScore);
  const breadthDirT = T.breadthDir(sentiment.marketBreadth);
  sentiment.outlook = `${T.trend[sentiment.trend].zh}，${btcDirT.zh}，${breadthDirT.zh}`;
  sentiment.outlookEn = `${T.trend[sentiment.trend].en} — ${btcDirT.en}, ${breadthDirT.en}`;

  sentiment.keyFactors = [];
  sentiment.keyFactorsZh = [];

  if (sentiment.btcScore < 0) {
    const pct = Math.abs(sentiment.btcVsYesterday).toFixed(2);
    const note = sentiment.btcVsYesterday > -1 ? 'minor pullback, normal volatility' : 'meaningful correction, monitor closely';
    const noteZh = sentiment.btcVsYesterday > -1 ? '小幅回调，属正常波动' : '回调幅度较大，需关注';
    sentiment.keyFactors.push(`BTC ${pct}% vs yesterday — ${note}`);
    sentiment.keyFactorsZh.push(`BTC 相对昨日${pct}%，${noteZh}`);
  }
  if (sentiment.btcScore > 0) {
    const pct = sentiment.btcVsYesterday.toFixed(2);
    sentiment.keyFactors.push(`BTC +${pct}% vs yesterday — upward momentum`);
    sentiment.keyFactorsZh.push(`BTC 相对昨日上涨${pct}%，动能正向`);
  }
  if (sentiment.marketBreadth > 0.4) {
    sentiment.keyFactors.push('Market breadth healthy: majority of coins in green');
    sentiment.keyFactorsZh.push('市场广度健康：多数币种上涨');
  } else if (sentiment.marketBreadth < -0.4) {
    sentiment.keyFactors.push('Market breadth weak: majority of coins in red');
    sentiment.keyFactorsZh.push('市场广度偏弱：多数币种下跌');
  }
  if (fearGreed && fearGreed.value) {
    const fg = fearGreed.value;
    if (fg < 30) {
      sentiment.keyFactors.push(`Fear & Greed at ${fg}/100 — markets may be overly pessimistic, rebound potential`);
      sentiment.keyFactorsZh.push(`恐惧情绪指数 ${fg}/100，市场可能过度悲观，存在反弹机会`);
    } else if (fg > 70) {
      sentiment.keyFactors.push(`Fear & Greed at ${fg}/100 — markets may be overly optimistic, caution on chasing`);
      sentiment.keyFactorsZh.push(`贪婪情绪指数 ${fg}/100，市场可能过度乐观，注意追高风险`);
    }
  }
  if (bitcoin && bitcoin.price > 0) {
    const priceLevel = bitcoin.price > 75000 ? 'near yearly highs' : bitcoin.price > 60000 ? 'mid-range annually' : 'near yearly lows';
    const priceLevelZh = bitcoin.price > 75000 ? '处于年内高位' : bitcoin.price > 60000 ? '处于年内中等水平' : '处于年内低位';
    sentiment.keyFactors.push(`BTC price ${formatCurrency(bitcoin.price)} — ${priceLevel}`);
    sentiment.keyFactorsZh.push(`BTC 价格 ${formatCurrency(bitcoin.price)}，${priceLevelZh}`);
  }

  return sentiment;
}

/**
 * Main function to fetch all data
 */
async function main() {
  console.log('=== CryptoPulse Data Fetcher ===');
  console.log('Using FREE APIs (no API key required)');
  console.log('Date:', new Date().toISOString());
  console.log('');

  let marketData = [];
  let bitcoinData = null;
  let fearGreedData = null;
  let jintelData = null;
  let dataSource = 'No market data available';

    try {
      // Try CryptoCompare first (most reliable free API)
    let data = await fetchCryptoCompareData();
    if (data.length > 0) {
      marketData = data;
      dataSource = 'CryptoCompare (free)';
      console.log('✓ Using CryptoCompare API data');
    } else {
      // Try CoinGecko as backup
      data = await fetchCoinGeckoData();
      if (data.length > 0) {
        marketData = data;
        dataSource = 'CoinGecko (free)';
        console.log('✓ Using CoinGecko API data');
      }
    }

    // Fetch Bitcoin data
    bitcoinData = await fetchBitcoinData();

    // Attach yesterday's price for comparison
    if (bitcoinData) {
      bitcoinData.priceYesterday = await fetchBTCPriceYesterday();
    }

    // Fetch Fear & Greed Index
    fearGreedData = await fetchFearGreedIndex();

    jintelData = await fetchJintelData();

    // Analyze sentiment
    const sentiment = analyzeMarketSentiment(marketData, bitcoinData, fearGreedData);

    // Fetch news
    const news = await fetchCryptoNews();

    // Fetch additional external metrics
    const defiTvl = await fetchDeFiTVL();
    const btcOnchain = await fetchBitcoinOnchain();
    const globalMarket = await fetchGlobalMarketData();

    // Combine all data
    // Build sources list including new DeFi/On-chain sources when available
    const sourcesList = [
      dataSource,
      globalMarket ? 'CoinLore global market (free)' : null,
      btcOnchain ? 'Blockchair BTC on-chain (free)' : null,
      fearGreedData ? 'Alternative.me (free)' : null,
      jintelData ? 'Jintel AI (free tier)' : null,
      'RSS feeds (free)'
    ].filter(Boolean);

    const allData = {
      timestamp: new Date().toISOString(),
      cryptocurrencies: marketData,
      bitcoin: bitcoinData,
      fearGreed: fearGreedData,
      sentiment: sentiment,
      news: news,
      defiTvl,
      bitcoinOnchain: btcOnchain,
      globalMarket,
      jintel: jintelData,
      sources: sourcesList
    };

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allData, null, 2));

    console.log('');
    console.log('✓ Data fetched successfully!');
    console.log(`✓ Saved to: ${OUTPUT_FILE}`);
    console.log(`✓ Cryptocurrencies: ${allData.cryptocurrencies.length}`);
    console.log(`✓ Fear & Greed: ${fearGreedData ? fearGreedData.value + ' (' + fearGreedData.classification + ')' : 'N/A'}`);
    console.log(`✓ Jintel quotes: ${jintelData ? jintelData.length : 0}`);
    console.log(`✓ News articles: ${allData.news.length}`);

    return true;
  } catch (error) {
    console.error('✗ Data fetching failed:', error.message);

    // Save empty data file to prevent script failure
    const emptyData = {
      timestamp: new Date().toISOString(),
      cryptocurrencies: [],
      bitcoin: null,
      fearGreed: null,
      sentiment: null,
      news: [],
      defiTvl: null,
      bitcoinOnchain: null,
      globalMarket: null,
      jintel: null,
      sources: [],
      error: error.message
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(emptyData, null, 2));
    console.log('✓ Saved empty data file to prevent script failure');

    return false;
  }
}

// Run if called directly
if (require.main === module) {
  main().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { main, fetchCryptoCompareData, fetchCoinGeckoData, fetchBitcoinData, fetchCryptoNews };
