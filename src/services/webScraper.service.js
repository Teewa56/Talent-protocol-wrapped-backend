const axios = require('axios');
const cheerio = require('cheerio');

class ScraperService {
    constructor() {
        this.baseURL = 'https://talent.app';
    }

    // Scrape user profile page for wrapped data
    async scrapeUserProfile(relativePath) {
        try {
            const url = `${this.baseURL}/${relativePath}`;
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);
            
            // Extract wrapped-relevant data from the page
            const scrapedData = {
                profileViews: this.extractProfileViews($),
                supporters: this.extractSupporters($),
                totalTokens: this.extractTotalTokens($),
                recentActivity: this.extractRecentActivity($),
                // Add more fields as needed based on the actual page structure
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

    async scrapeUserScores(relativePath){
        try {
            const url = `${this.baseURL}/${relativePath}/scores`;
            
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });
        } catch (error) {
            console.error('Error scraping user activity:', error.message);
            return {
                success: false,
                error: error.message
            }
        }
    }

    // Helper methods to extract specific data
    extractProfileViews($) {
        // Adjust selectors based on actual HTML structure
        const views = $('.profile-views').text() || '0';
        return parseInt(views.replace(/\D/g, '')) || 0;
    }

    extractSupporters($) {
        const supporters = $('.supporters-count').text() || '0';
        return parseInt(supporters.replace(/\D/g, '')) || 0;
    }

    extractTotalTokens($) {
        const tokens = $('.total-tokens').text() || '0';
        return parseFloat(tokens.replace(/[^\d.]/g, '')) || 0;
    }

    extractRecentActivity($) {
        const activities = [];
        $('.activity-item').each((i, elem) => {
            activities.push({
                type: $(elem).find('.activity-type').text().trim(),
                date: $(elem).find('.activity-date').text().trim(),
                description: $(elem).find('.activity-desc').text().trim()
            });
        });
        return activities;
    }
}

module.exports = new ScraperService();