/**
 * CryptoPulse Data Fetcher
 * Fetches cryptocurrency data from multiple FREE APIs (no API key required)
 */

const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');

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

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Custom fetch with proxy support and retries
 */
async function fetchWithRetry(url, options = {}, retries = 3) {
  const fetchFn = (opts) => {
    const mergedOptions = { ...fetchOptions, ...opts };
    return fetch(url, mergedOptions);
  };

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchFn(options);
      if (response.ok) return response;
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
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
 * Fetch Bitcoin data from Blockchain.info (FREE, no auth)
 */
async function fetchBitcoinData() {
  try {
    console.log('Fetching Bitcoin data...');

    const response = await fetchWithRetry('https://blockchain.info/ticker', { timeout: 10000 });
    if (!response.ok) {
      throw new Error(`Blockchain.info API error: ${response.status}`);
    }

    const data = await response.json();
    const usdData = data.USD;

    return {
      symbol: 'BTC',
      name: 'Bitcoin',
      price: usdData.last,
      volume24h: usdData.volume,
      high24h: usdData.high,
      low24h: usdData.low
    };
  } catch (error) {
    console.warn('Bitcoin data fetch failed:', error.message);
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

/**
 * Generate market sentiment based on data
 */
function analyzeMarketSentiment(cryptos, bitcoin) {
  const sentiment = {
    overall: 'Neutral',
    fearGreed: null,
    trend: 'sideways',
    outlook: '',
    keyFactors: []
  };

  // Calculate market metrics
  let totalChange = 0;
  let gainers = 0;
  let losers = 0;
  let totalVolume = 0;

  cryptos.forEach(coin => {
    if (coin.priceChange24h > 0) {
      gainers++;
      totalChange += coin.priceChange24h;
    } else if (coin.priceChange24h < 0) {
      losers++;
      totalChange += coin.priceChange24h;
    }
    totalVolume += coin.volume24h || 0;
  });

  const avgChange = cryptos.length > 0 ? totalChange / cryptos.length : 0;
  const marketDominance = cryptos.find(c => c.symbol === 'BTC')?.marketCap || 0;

  // Determine trend
  if (avgChange > 2) {
    sentiment.trend = 'bullish';
  } else if (avgChange < -2) {
    sentiment.trend = 'bearish';
  } else if (avgChange > 0) {
    sentiment.trend = 'slightly_bullish';
  } else if (avgChange < 0) {
    sentiment.trend = 'slightly_bearish';
  }

  // Generate outlook
  const trendText = {
    bullish: '上涨趋势',
    bearish: '下跌趋势',
    slightly_bullish: '小幅上涨',
    slightly_bearish: '小幅下跌',
    sideways: '横盘整理'
  };

  sentiment.outlook = `${trendText[sentiment.trend]}，市场${losers > gainers ? '整体回调' : '表现稳健'}`;

  // Key factors
  if (avgChange < -3) {
    sentiment.keyFactors.push('市场大幅回调，投资者需注意风险');
  }
  if (losers > gainers * 2) {
    sentiment.keyFactors.push('多数币种下跌，市场情绪偏空');
  }
  if (avgChange > 2) {
    sentiment.keyFactors.push('市场普遍上涨，情绪转为乐观');
  }
  if (bitcoin && bitcoin.price) {
    sentiment.keyFactors.push(`比特币价格${bitcoin.price > 70000 ? '维持高位' : '有所回落'}`);
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

    // Fetch Fear & Greed Index
    fearGreedData = await fetchFearGreedIndex();

    // Analyze sentiment
    const sentiment = analyzeMarketSentiment(marketData, bitcoinData);
    if (fearGreedData) {
      sentiment.fearGreed = fearGreedData;
    }

    // Fetch news
    const news = await fetchCryptoNews();

    // Combine all data
    const allData = {
      timestamp: new Date().toISOString(),
      cryptocurrencies: marketData,
      bitcoin: bitcoinData,
      fearGreed: fearGreedData,
      sentiment: sentiment,
      news: news,
      sources: [
        dataSource,
        bitcoinData ? 'Blockchain.info (free)' : 'No Bitcoin data',
        fearGreedData ? 'Alternative.me (free)' : 'No Fear & Greed data',
        'RSS feeds (free)'
      ]
    };

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allData, null, 2));

    console.log('');
    console.log('✓ Data fetched successfully!');
    console.log(`✓ Saved to: ${OUTPUT_FILE}`);
    console.log(`✓ Cryptocurrencies: ${allData.cryptocurrencies.length}`);
    console.log(`✓ Fear & Greed: ${fearGreedData ? fearGreedData.value + ' (' + fearGreedData.classification + ')' : 'N/A'}`);
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