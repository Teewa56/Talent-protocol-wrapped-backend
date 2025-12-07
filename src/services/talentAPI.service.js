const axios = require('axios');
const config = require('../config/index');

class TalentApiService {
    constructor() {
        this.baseURL = config.talentProtocol.apiUrl;
        this.apiKey = config.talentProtocol.apiKey;
        this.headers = {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json'
        };
    }

    // Fetch user profile by basename - THIS IS A POST REQUEST
    async getUserProfile(baseName) {
        try {
            const data = {
                "query": {
                    "identity": `${baseName}`,
                   "exactMatch": true
                },
                "sort": {
                    "id": { "order": "asc" }
                },
                page: 1,
                per_page: 25
            }

            const queryString = Object.keys(data)
                .map(key => `${key}=${encodeURIComponent(JSON.stringify(data[key]))}`)
                .join("&");
                
            const response = await axios.get(`${this.baseURL}/search/advanced/profiles?${queryString}`, {headers: this.headers});
            console.log('profile', response.data)
            if (!response.data.profiles || response.data.profiles.length === 0) {
                return { success: false, error: 'User not found' };
            }

            const profile = response.data.profiles[0];
            return {
                success: true,
                data: this.formatProfileData(profile),
                relativePath: profile.relative_path,
                rawProfile: profile
            };
        } catch (error) {
            return this.handleError('getUserProfile', error);
        }
    }
    
    // Get all data points for a user
    async getDataPoints(identifier, credentialSlug = null) {
        try {
            const url = credentialSlug 
                ? `${this.baseURL}/data_points/${credentialSlug}/${identifier}`
                : `${this.baseURL}/data_points/${identifier}`;
                
            const response = await axios.get(url, { headers: this.headers });
            console.log('datapoints', response.data)
            // Check if response is HTML (authentication error)
            if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
                return {
                    success: false,
                    error: 'Authentication required - endpoint needs valid API key'
                };
            }

            return {
                success: true,
                data: response.data.data_points || response.data,
                metadata: response.data.metadata || null
            };
        } catch (error) {
            return this.handleError('getDataPoints', error);
        }
    }

    // Get specific activity data points
    async getActivityDataPoints(identifier) {
        try {
            // Fetch onchain activity data points
            const onchainActivity = await this.getDataPoints(identifier, 'onchain_activity');
            const githubData = await this.getDataPoints(identifier, 'github');
            const baseData = await this.getDataPoints(identifier, 'base');
            
            return {
                success: true,
                data: {
                    onchain: onchainActivity.success ? onchainActivity.data : null,
                    github: githubData.success ? githubData.data : null,
                    base: baseData.success ? baseData.data : null
                }
            };
        } catch (error) {
            return this.handleError('getActivityDataPoints', error);
        }
    }

    // Get credentials for a user
    async getCredentials(identifier) {
        try {
            const data = {
                "query": {
                    "id": `${identifier}`,
                    "exactMatch": true
                },
                "sort": {
                    "id": { "order": "asc" }
                },
                page: 1,
                per_page: 25
            }

            const queryString = Object.keys(data)
                .map(key => `${key}=${encodeURIComponent(JSON.stringify(data[key]))}`)
                .join("&");

            const response = await axios.get(
                `${this.baseURL}/credentials/?identifier=${queryString}`,
                { headers: this.headers }
            );

            console.log('getcredentials', response.data)

            if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
                return { success: false, error: 'Authentication required' };
            }

            return {
                success: true,
                data: response.data.credentials || response.data
            };
        } catch (error) {
            return this.handleError('getCredentials', error);
        }
    }

    // Get historical events/activity for a user - POST REQUEST
    async getEvents(identifier, options = {}) {
        try {
            const params = {
                account_identifier: identifier,
                page: options.page || 1,
                per_page: options.perPage || 50,
                ...options
            };

            const response = await axios.post(
                `${this.baseURL}/search/advanced/events`,
                params,
                { headers: this.headers }
            );

            console.log('getevents', response.data)

            if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
                return { success: false, error: 'Authentication required' };
            }

            return {
                success: true,
                data: response.data.events || [],
                pagination: response.data.pagination || null
            };
        } catch (error) {
            return this.handleError('getEvents', error);
        }
    }
    
    // Get connected accounts for a user
    async getAccounts(identifier) {
        try {
            const response = await axios.get(
                `${this.baseURL}/accounts/${identifier}`,
                { headers: this.headers }
            );

            console.log('accounts', response.data)

            if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
                return { success: false, error: 'Authentication required' };
            }

            return {
                success: true,
                data: response.data.accounts || []
            };
        } catch (error) {
            return this.handleError('getAccounts', error);
        }
    }
    
    // Get social connections
    async getSocials(identifier) {
        try {
            const response = await axios.get(
                `${this.baseURL}/socials/${identifier}`,
                { headers: this.headers }
            );

            console.log('socails', response.data)

            if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
                return { success: false, error: 'Authentication required' };
            }

            return {
                success: true,
                data: response.data.socials || []
            };
        } catch (error) {
            return this.handleError('getSocials', error);
        }
    }
    
    // Get projects created by the user
    async getProjects(identifier) {
        try {
            const response = await axios.get(
                `${this.baseURL}/projects/${identifier}`,
                { headers: this.headers }
            );
            
            console.log('projects', response.data)

            if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
                return { success: false, error: 'Authentication required' };
            }

            return {
                success: true,
                data: response.data.projects || []
            };
        } catch (error) {
            return this.handleError('getProjects', error);
        }
    }
    
    // Get specific score by slug
    async getScore(identifier, scoreSlug) {
        try {
            const response = await axios.get(
                `${this.baseURL}/scores/${scoreSlug}/${identifier}`,
                { headers: this.headers }
            );
            
            console.log('score', response.data)

            if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
                return { success: false, error: 'Authentication required' };
            }

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return this.handleError('getScore', error);
        }
    }

    // Get all scores for a user
    async getAllScores(identifier) {
        try {
            const scores = {};
            const scoreSlugs = ['builder_score', 'creator_score', 'base_builder_score'];
            
            for (const slug of scoreSlugs) {
                const result = await this.getScore(identifier, slug);
                if (result.success) {
                    scores[slug] = result.data;
                }
            }

            return {
                success: true,
                data: scores
            };
        } catch (error) {
            return this.handleError('getAllScores', error);
        }
    }
    
    async getHumanCheckmark(identifier) {
        try {
            const response = await axios.get(
                `${this.baseURL}/human_checkmark/${identifier}`,
                { headers: this.headers }
            );
            
            console.log('checkmark', response.data)

            if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE html>')) {
                return { success: false, error: 'Authentication required' };
            }

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            return this.handleError('getHumanCheckmark', error);
        }
    }
    
    // Get all wrapped-relevant data in one method
    async getComprehensiveWrappedData(baseName) {
        try {
            // First, get the profile
            const profile = await this.getUserProfile(baseName);
            
            if (!profile.success) {
                return profile; // Return the error
            }

            const userId = profile.data.id || baseName;

            // Fetch all data in parallel using the user ID
            const [
                dataPoints,
                credentials,
                events,
                accounts,
                socials,
                projects,
                humanCheckmark
            ] = await Promise.all([
                this.getActivityDataPoints(userId),
                this.getCredentials(userId),
                this.getEvents(userId, { per_page: 100 }),
                this.getAccounts(userId),
                this.getSocials(userId),
                this.getProjects(userId),
                this.getHumanCheckmark(userId)
            ]);

            return {
                success: true,
                data: {
                    profile: profile.data,
                    dataPoints: dataPoints.success ? dataPoints.data : null,
                    credentials: credentials.success ? credentials.data : null,
                    events: events.success ? events.data : null,
                    accounts: accounts.success ? accounts.data : null,
                    socials: socials.success ? socials.data : null,
                    projects: projects.success ? projects.data : null,
                    humanCheckmark: humanCheckmark.success ? humanCheckmark.data : null
                },
                relativePath: profile.relativePath
            };
        } catch (error) {
            return this.handleError('getComprehensiveWrappedData', error);
        }
    }

    formatProfileData(profile) {
        return {
            id: profile.id,
            name: profile.name,
            displayName: profile.display_name,
            bio: profile.bio,
            imageUrl: profile.image_url,
            location: profile.location,
            tags: profile.tags,
            humanCheckmark: profile.human_checkmark,
            verifiedNationality: profile.verified_nationality,
            createdAt: profile.created_at,
            talentProtocolId: profile.talent_protocol_id,
            builderScore: profile.builder_score,
            scores: profile.scores,
            profileRefreshedAt: profile.profile_refreshed_at
        };
    }

    handleError(methodName, error) {
        console.error(`Error in ${methodName}:`, error.message);
        if (error.response?.data) {
            const dataPreview = typeof error.response.data === 'string' 
                ? error.response.data.substring(0, 200) 
                : JSON.stringify(error.response.data).substring(0, 200);
            console.error('Response data preview:', dataPreview);
        }
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            statusCode: error.response?.status || 500
        };
    }
}

module.exports = new TalentApiService();