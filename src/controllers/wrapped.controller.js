const talentApiService = require('../services/talentAPI.service');
const scraperService = require('../services/webScraper.service');
const { formatSuccess, formatError } = require('../utils/response.formatter');

class WrappedController {
    // Get complete wrapped data for a user
    async getWrappedData(req, res) {
        try {
            const { baseName } = req.params;

            if (!baseName) {
                return res.status(400).json(formatError('User ID is required'));
            }

            // Step 1: Fetch user data from API
            const apiResult = await talentApiService.getUserData(baseName);
            
            if (!apiResult.success) {
                return res.status(500).json(formatError('Failed to fetch user data from API', apiResult.error));
            }

            // Step 2: Get stats from API
            const statsResult = await talentApiService.getUserStats(baseName);

            // Step 3: Scrape additional data from user profile
            const scrapedResult = await scraperService.scrapeUserProfile(apiResult.relativePath);

            // Step 4: Combine all data
            const wrappedData = {
                user: apiResult.data,
                stats: statsResult.success ? statsResult.data : null,
                scrapedData: scrapedResult.success ? scrapedResult.data : null,
                generatedAt: new Date().toISOString()
            };

            return res.status(200).json(formatSuccess(wrappedData, 'Wrapped data fetched successfully'));
        
        } catch (error) {
            console.error('Error in getWrappedData:', error);
            return res.status(500).json(formatError('Internal server error', error.message));
        }
    }

    // Health check endpoint
    async healthCheck(req, res) {
        return res.status(200).json(formatSuccess({ status: 'healthy' }, 'Service is running'));
    }
}

module.exports = new WrappedController();