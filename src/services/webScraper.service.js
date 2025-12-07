const axios = require('axios');
const cheerio = require('cheerio');

class ScraperService {
    constructor() {
        this.baseURL = 'https://talent.app';
    }

    // Scrape user profile page for activity data
    async scrapeUserProfile(relativePath) {
        try {
            const url = `${this.baseURL}${relativePath}`;
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 15000
            });

            const $ = cheerio.load(response.data);
            
            // Extract activity metrics from the profile page
            const scrapedData = {
                activity: {
                    currentStreak: this.extractMetric($, 'Current Streak'),
                    totalActivity: this.extractMetric($, 'Total  Activity') || this.extractMetric($, 'Total Activity'),
                    uniqueDays: this.extractMetric($, 'Unique  Days') || this.extractMetric($, 'Unique Days'),
                    longestStreak: this.extractMetric($, 'Longest  Streak') || this.extractMetric($, 'Longest Streak'),
                },
                builderRewards: this.extractBuilderRewards($),
                githubContributions: this.extractGithubContributions($),
                contractsDeployed: this.extractContractsDeployed($),
                creatorCoin: {
                    marketCap: this.extractCreatorCoinMetric($, 'Market Cap'),
                    totalVolume: this.extractCreatorCoinMetric($, 'Total Volume'),
                    holders: this.extractCreatorCoinMetric($, 'Coin Holders'),
                },
                followers: this.extractFollowers($),
                rank: this.extractRank($)
            };

            return {
                success: true,
                data: scrapedData,
                scrapedFrom: url
            };
        } catch (error) {
            console.error('Error scraping user profile:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Scrape user scores page
    async scrapeUserScores(relativePath) {
        try {
            const url = `${this.baseURL}${relativePath}/scores`;
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 15000
            });

            const $ = cheerio.load(response.data);

            // Extract score information
            const scores = this.extractScoresFromPage($);

            return {
                success: true,
                data: scores,
                scrapedFrom: url
            };
        } catch (error) {
            console.error('Error scraping user scores:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Helper: Extract a metric value by label
    extractMetric($, label) {
        let value = null;
        
        // Try to find the metric by searching for text containing the label
        $('*').each((i, elem) => {
            const text = $(elem).text().trim();
            if (text.includes(label)) {
                // Get the next numeric value
                const parent = $(elem).parent();
                const siblings = parent.children();
                siblings.each((j, sibling) => {
                    const siblingText = $(sibling).text().trim();
                    const number = parseInt(siblingText.replace(/\D/g, ''));
                    if (!isNaN(number) && value === null) {
                        value = number;
                    }
                });
            }
        });

        return value || 0;
    }

    // Helper: Extract builder rewards
    extractBuilderRewards($) {
        const text = $('*:contains("Talent.app Builder Rewards")').text();
        const match = text.match(/\$?([\d,]+\.?\d*)/);
        return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
    }

    // Helper: Extract GitHub contributions
    extractGithubContributions($) {
        const text = $('*:contains("GitHub Total Contributions")').text();
        const match = text.match(/([\d,]+)/);
        return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    }

    // Helper: Extract contracts deployed
    extractContractsDeployed($) {
        const text = $('*:contains("Contracts Deployed")').text();
        const match = text.match(/([\d,]+)/);
        return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    }

    // Helper: Extract creator coin metrics
    extractCreatorCoinMetric($, label) {
        const text = $(`*:contains("${label}")`).text();
        const match = text.match(/\$?([\d,]+\.?\d*)/);
        return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
    }

    // Helper: Extract followers count
    extractFollowers($) {
        const text = $('*:contains("Followers")').text();
        const match = text.match(/([\d,]+)\s*Followers/);
        return match ? parseInt(match[1].replace(/,/g, '')) : 0;
    }

    // Helper: Extract rank
    extractRank($) {
        const text = $('*:contains("Builder Rank")').text();
        const match = text.match(/#(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    // Helper: Extract scores from scores page
    extractScoresFromPage($) {
        const scores = [];
        
        // Look for score elements (adjust selectors based on actual HTML)
        $('*').each((i, elem) => {
            const text = $(elem).text();
            // Match patterns like "#1 567 Points"
            const match = text.match(/#(\d+)\s+([\d,]+)\s+Points/);
            if (match) {
                const parent = $(elem).parent();
                const scoreType = parent.find('*:first').text().trim();
                scores.push({
                    type: scoreType,
                    rank: parseInt(match[1]),
                    points: parseInt(match[2].replace(/,/g, ''))
                });
            }
        });

        return scores;
    }
}

module.exports = new ScraperService();