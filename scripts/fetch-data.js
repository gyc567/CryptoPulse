/**
 * CryptoPulse Data Fetcher
 * Fetches cryptocurrency data from multiple FREE APIs (no API key required)
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'raw-data.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Fetch top cryptocurrencies from CryptoPrice API (FREE, no auth)
 */
async function fetchCryptoPriceData() {
  try {
    console.log('Fetching data from CryptoPrice API...');

    const response = await fetch(
      'https://api.cryptocurrencyprice.com/api/v1/coins',
      { timeout: 10000 }
    );

    if (!response.ok) {
      throw new Error(`CryptoPrice API error: ${response.status}`);
    }

    const data = await response.json();

    // Get top 10 coins with complete data
    return data.slice(0, 10).map(coin => ({
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
    console.warn('CryptoPrice fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch cryptocurrency data from CoinGecko API (FREE tier)
 */
async function fetchCoinGeckoData() {
  try {
    console.log('Fetching data from CoinGecko API...');

    const response = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=false&price_change_percentage=24h',
      { timeout: 10000 }
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
 * Fetch data from Coinbase API (FREE, no auth required)
 */
async function fetchCoinbaseData() {
  try {
    console.log('Fetching data from Coinbase API...');

    const response = await fetch(
      'https://api.coinbase.com/v2/exchange-rates?currency=USD',
      { timeout: 10000 }
    );

    if (!response.ok) {
      throw new Error(`Coinbase API error: ${response.status}`);
    }

    const data = await response.json();

    // Get top cryptocurrencies by market cap (manual list)
    const topCoins = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'AVAX', 'MATIC'];

    return topCoins.map(symbol => {
      const rate = data.data.rates[symbol];
      return {
        id: symbol.toLowerCase(),
        symbol: symbol,
        name: getCoinName(symbol),
        price: rate ? parseFloat(rate) : null,
        priceChange24h: null,
        marketCap: null,
        volume24h: null
      };
    }).filter(coin => coin.price !== null);
  } catch (error) {
    console.warn('Coinbase fetch failed:', error.message);
    return [];
  }
}

/**
 * Fetch Bitcoin data from Blockchain.info (FREE, no auth)
 */
async function fetchBitcoinData() {
  try {
    console.log('Fetching Bitcoin data...');

    const response = await fetch('https://blockchain.info/ticker', { timeout: 10000 });
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
        const response = await fetch(
          `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed)}`,
          { timeout: 8000 }
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
 * Get coin name from symbol
 */
function getCoinName(symbol) {
  const names = {
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'BNB': 'BNB',
    'SOL': 'Solana',
    'XRP': 'XRP',
    'ADA': 'Cardano',
    'DOGE': 'Dogecoin',
    'DOT': 'Polkadot',
    'AVAX': 'Avalanche',
    'MATIC': 'Polygon'
  };
  return names[symbol] || symbol;
}

/**
 * Main function to fetch all data
 */
async function main() {
  console.log('=== CryptoPulse Data Fetcher ===');
  console.log('Using FREE APIs (no API key required)');
  console.log('Date:', new Date().toISOString());
  console.log('');

  try {
    // Fetch data from multiple sources in parallel with timeout
    const [cryptoPriceData, coinGeckoData, coinbaseData, bitcoinData, news] = await Promise.all([
      fetchCryptoPriceData(),
      fetchCoinGeckoData(),
      fetchCoinbaseData(),
      fetchBitcoinData(),
      fetchCryptoNews()
    ]);

    // Prioritize data sources
    let marketData = [];
    if (cryptoPriceData.length > 0) {
      marketData = cryptoPriceData;
      console.log('✓ Using CryptoPrice API data');
    } else if (coinGeckoData.length > 0) {
      marketData = coinGeckoData;
      console.log('✓ Using CoinGecko API data');
    } else if (coinbaseData.length > 0) {
      marketData = coinbaseData;
      console.log('✓ Using Coinbase API data');
    }

    // Combine all data
    const allData = {
      timestamp: new Date().toISOString(),
      cryptocurrencies: marketData,
      bitcoin: bitcoinData,
      news: news,
      sources: [
        marketData.length > 0 ? 'CryptoPrice/CoinGecko/Coinbase (free)' : 'No market data available',
        'Blockchain.info (free)',
        'RSS feeds (free)'
      ]
    };

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allData, null, 2));

    console.log('');
    console.log('✓ Data fetched successfully!');
    console.log(`✓ Saved to: ${OUTPUT_FILE}`);
    console.log(`✓ Cryptocurrencies: ${allData.cryptocurrencies.length}`);
    console.log(`✓ News articles: ${allData.news.length}`);
    console.log(`✓ Data sources: ${allData.sources.length}`);

    return true;
  } catch (error) {
    console.error('✗ Data fetching failed:', error.message);

    // Save empty data file to prevent script failure
    const emptyData = {
      timestamp: new Date().toISOString(),
      cryptocurrencies: [],
      bitcoin: null,
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

module.exports = { main, fetchCryptoPriceData, fetchCoinGeckoData, fetchCoinbaseData, fetchBitcoinData, fetchCryptoNews };