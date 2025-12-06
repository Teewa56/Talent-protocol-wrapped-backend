const axios = require('axios');
const config = require('../config/index');

class TalentApiService {
    constructor() {
        this.baseURL = config.talentProtocol.apiUrl;
        this.apiKey = config.talentProtocol.apiKey;
    }

    // Fetch user data from Talent Protocol API
    async getUserData(userId) {
        try {
        const response = await axios.get(`${this.baseURL}/users/${userId}`, {
            headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
            }
        });

        return {
            success: true,
            data: response.data,
            relativePath: this.extractRelativePath(response.data) // Extract path for scraper
        };
        } catch (error) {
        console.error('Error fetching user data from API:', error.message);
        return {
            success: false,
            error: error.message
        };
        }
    }

    // Extract the relative path from user data
    extractRelativePath(userData) {
        // Adjust based on actual API response structure
        // Example: userData.username or userData.profile_path
        return userData.username || userData.handle || userData.id;
    }

    // Fetch additional stats if available from API
    async getUserStats(userId) {
        try {
            const response = await axios.get(`${this.baseURL}/users/${userId}/stats`, {
                headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('Error fetching user stats from API:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new TalentApiService();