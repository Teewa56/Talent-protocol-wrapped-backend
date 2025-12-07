const axios = require('axios');
const config = require('../config/index');
const scraperService = require('./scraper.service');

class TalentApiService {
    constructor() {
        this.baseURL = config.talentProtocol.apiUrl;
        this.apiKey = config.talentProtocol.apiKey;
        this.headers = {
            'X-API-KEY': this.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    async getUserProfile(baseName) {
        try {
            const data = {
                "query": {
                    "identity": baseName,
                    "exactMatch": true
                },
                "sort": {
                    "id": { "order": "asc" }
                },
                page: 1,
                per_page: 25
            };

            const queryString = Object.keys(data)
                .map(key => `${key}=${encodeURIComponent(JSON.stringify(data[key]))}`)
                .join("&");
                
            const response = await axios.get(
                `${this.baseURL}/search/advanced/profiles?${queryString}`, 
                { headers: this.headers }
            );
            
            console.log('Profile fetched');
            
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
    
    async getScore(identifier, scorerSlug = 'builder_score') {
        try {
            const params = {
                id: identifier,
                scorer_slug: scorerSlug
            };
            
            const response = await axios.get(`${this.baseURL}/score`, {
                headers: this.headers,
                params: params
            });
            
            console.log(`Score (${scorerSlug}) fetched`);
            
            return {
                success: true,
                data: response.data.score || response.data
            };
        } catch (error) {
            return this.handleError(`getScore (${scorerSlug})`, error);
        }
    }

    async getAllScores(identifier) {
        try {
            const scoreSlugs = ['builder_score', 'creator_score', 'base_builder_score', 'base200_score'];
            const scores = {};
            
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

    async getCredentials(identifier) {
        try {
            const data = {
                "query": {
                    "profile_id": identifier
                },
                "sort": {
                    "last_calculated_at": { "order": "desc" }
                },
                page: 1,
                per_page: 100
            };

            const queryString = Object.keys(data)
                .map(key => `${key}=${encodeURIComponent(JSON.stringify(data[key]))}`)
                .join("&");

            const response = await axios.get(
                `${this.baseURL}/search/advanced/credentials?${queryString}`,
                { headers: this.headers }
            );

            console.log('Credentials fetched');

            return {
                success: true,
                data: response.data.credentials || []
            };
        } catch (error) {
            console.log('Credentials unavailable');
            return { success: false, error: error.message, data: [] };
        }
    }

    async getEvents(identifier, options = {}) {
        try {
            const data = {
                "query": {
                    "profile_id": identifier
                },
                "sort": {
                    "created_at": { "order": "desc" }
                },
                page: options.page || 1,
                per_page: options.perPage || 100
            };

            const queryString = Object.keys(data)
                .map(key => `${key}=${encodeURIComponent(JSON.stringify(data[key]))}`)
                .join("&");

            const response = await axios.get(
                `${this.baseURL}/search/advanced/events?${queryString}`,
                { headers: this.headers }
            );

            console.log('Events fetched');

            return {
                success: true,
                data: response.data.events || [],
                pagination: response.data.pagination || null
            };
        } catch (error) {
            console.log('Events unavailable');
            return { success: false, error: error.message, data: [] };
        }
    }

    extractProfileData(profile) {
        return {
            socials: this.extractSocials(profile),
            accounts: this.extractAccounts(profile),
            tags: profile.tags || [],
            scores: profile.scores || []
        };
    }

    extractSocials(profile) {
        const socials = [];
        
        if (profile.twitter_handle || profile.x_handle) {
            socials.push({
                platform: 'twitter',
                handle: profile.twitter_handle || profile.x_handle
            });
        }
        
        if (profile.github_handle) {
            socials.push({
                platform: 'github',
                handle: profile.github_handle
            });
        }
        
        if (profile.farcaster_handle) {
            socials.push({
                platform: 'farcaster',
                handle: profile.farcaster_handle
            });
        }
        
        return socials;
    }

    extractAccounts(profile) {
        const accounts = [];
        
        if (profile.main_wallet) {
            accounts.push({
                type: 'wallet',
                address: profile.main_wallet,
                isPrimary: true
            });
        }
        
        if (profile.verified_wallets && Array.isArray(profile.verified_wallets)) {
            profile.verified_wallets.forEach(wallet => {
                if (wallet !== profile.main_wallet) {
                    accounts.push({
                        type: 'wallet',
                        address: wallet,
                        isPrimary: false
                    });
                }
            });
        }
        
        return accounts;
    }
    
    async getComprehensiveWrappedData(baseName) {
        try {
            const profileResult = await this.getUserProfile(baseName);
            
            if (!profileResult.success) {
                return profileResult;
            }

            const profile = profileResult.rawProfile;
            const userId = profileResult.data.id;
            const relativePath = profileResult.relativePath;

            const embeddedData = this.extractProfileData(profile);

            const [
                credentials,
                events,
                allScores
            ] = await Promise.all([
                this.getCredentials(userId),
                this.getEvents(userId, { perPage: 100 }),
                this.getAllScores(userId)
            ]);

            console.log('\n🕷️  Starting web scraping...');
            const scrapedData = await scraperService.scrapeProfile(relativePath);

            console.log('\n📊 Data Summary:');
            console.log(`   Profile: ✅`);
            console.log(`   Credentials: ${credentials.success ? '✅' : '⚠️'}`);
            console.log(`   Events: ${events.success ? '✅' : '⚠️'}`);
            console.log(`   Scores: ${allScores.success ? '✅' : '⚠️'}`);
            console.log(`   Scraping: ${scrapedData.success ? '✅' : '⚠️'}\n`);

            return {
                success: true,
                data: {
                    profile: profileResult.data,
                    socials: embeddedData.socials,
                    accounts: embeddedData.accounts,
                    tags: embeddedData.tags,
                    credentials: credentials.success ? credentials.data : [],
                    events: events.success ? events.data : [],
                    allScores: allScores.success ? allScores.data : {},
                    humanCheckmark: profile.human_checkmark || false,
                    projects: scrapedData.success ? scrapedData.data.projects : [],
                    scrapedStats: scrapedData.success ? scrapedData.data.detailedStats : {},
                    activityFeed: scrapedData.success ? scrapedData.data.activityFeed : [],
                    skills: scrapedData.success ? scrapedData.data.skills : [],
                    achievements: scrapedData.success ? scrapedData.data.achievements : [],
                    scrapingSuccess: scrapedData.success
                },
                relativePath: profileResult.relativePath
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
            profileRefreshedAt: profile.profile_refreshed_at,
            mainWallet: profile.main_wallet,
            verifiedWallets: profile.verified_wallets,
            twitterHandle: profile.twitter_handle || profile.x_handle,
            githubHandle: profile.github_handle,
            farcasterHandle: profile.farcaster_handle
        };
    }

    handleError(methodName, error) {
        console.error(`❌ Error in ${methodName}:`, error.message);
        
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            
            const isHtml = typeof error.response.data === 'string' && 
                          error.response.data.includes('<!DOCTYPE html>');
            
            if (isHtml) {
                console.error('   Response: HTML (endpoint unavailable)');
            }
        }
        
        return {
            success: false,
            error: error.response?.data?.error || error.response?.data?.message || error.message,
            statusCode: error.response?.status || 500
        };
    }
}

module.exports = new TalentApiService();