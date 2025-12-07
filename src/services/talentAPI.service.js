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

    // Fetch user profile by basename
    async getUserProfile(baseName) {
        try {
            const response = await axios.get(`${this.baseURL}/search/advanced/profiles`, {
                params: { name: baseName },
                headers: this.headers
            });

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
    
    // Get all data points for a user (comprehensive activity data)
    async getDataPoints(identifier, credentialSlug = null) {
        try {
            const url = credentialSlug 
                ? `${this.baseURL}/data_points/${credentialSlug}/${identifier}`
                : `${this.baseURL}/data_points/${identifier}`;
                
            const response = await axios.get(url, { headers: this.headers });

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
    async getActivityDataPoints(baseName) {
        try {
            // Fetch onchain activity data points
            const onchainActivity = await this.getDataPoints(baseName, 'onchain_activity');
            const githubData = await this.getDataPoints(baseName, 'github');
            const baseData = await this.getDataPoints(baseName, 'base');
            
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
            const response = await axios.get(
                `${this.baseURL}/credentials/${identifier}`,
                { headers: this.headers }
            );

            return {
                success: true,
                data: response.data.credentials || response.data
            };
        } catch (error) {
            return this.handleError('getCredentials', error);
        }
    }

    // Get historical events/activity for a user
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

            return {
                success: true,
                data: response.data.events || response.data,
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

            return {
                success: true,
                data: response.data.accounts || response.data
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

            return {
                success: true,
                data: response.data.socials || response.data
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

            return {
                success: true,
                data: response.data.projects || response.data
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
            // Fetch all data in parallel
            const [
                profile,
                dataPoints,
                credentials,
                events,
                accounts,
                socials,
                projects,
                humanCheckmark
            ] = await Promise.all([
                this.getUserProfile(baseName),
                this.getActivityDataPoints(baseName),
                this.getCredentials(baseName),
                this.getEvents(baseName, { per_page: 100 }),
                this.getAccounts(baseName),
                this.getSocials(baseName),
                this.getProjects(baseName),
                this.getHumanCheckmark(baseName)
            ]);

            return {
                success: true,
                data: {
                    profile: profile.success ? profile.data : null,
                    dataPoints: dataPoints.success ? dataPoints.data : null,
                    credentials: credentials.success ? credentials.data : null,
                    events: events.success ? events.data : null,
                    accounts: accounts.success ? accounts.data : null,
                    socials: socials.success ? socials.data : null,
                    projects: projects.success ? projects.data : null,
                    humanCheckmark: humanCheckmark.success ? humanCheckmark.data : null
                },
                relativePath: profile.success ? profile.relativePath : null
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
        return {
            success: false,
            error: error.response?.data?.message || error.message,
            statusCode: error.response?.status || 500
        };
    }
}

module.exports = new TalentApiService();