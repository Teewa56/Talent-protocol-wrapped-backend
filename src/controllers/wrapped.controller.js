const talentApiService = require('../services/talentAPI.service');
const scraperService = require('../services/webScraper.service');
const { formatSuccess, formatError } = require('../utils/response.formatter');

class WrappedController {
    // Get complete wrapped data for a user
    async getWrappedData(req, res) {
        try {
            const { baseName } = req.params;

            if (!baseName) {
                return res.status(400).json(formatError('Base name is required'));
            }

            // Step 1: Fetch comprehensive data from API
            const apiData = await talentApiService.getComprehensiveWrappedData(baseName);
            console.log(apiData)
            if (!apiData.success) {
                return res.status(404).json(formatError('User not found', apiData.error));
            }

            // Step 3: Process and calculate wrapped statistics
            const wrappedStats = calculateWrappedStats(apiData.data);

            // Step 4: Combine all data into wrapped format
            const wrappedData = {
                user: {
                    id: apiData.data.profile?.id,
                    name: apiData.data.profile?.name,
                    displayName: apiData.data.profile?.displayName,
                    bio: apiData.data.profile?.bio,
                    imageUrl: apiData.data.profile?.imageUrl,
                    location: apiData.data.profile?.location,
                    tags: apiData.data.profile?.tags,
                    verified: {
                        human: apiData.data.humanCheckmark,
                        nationality: apiData.data.profile?.verifiedNationality
                    },
                    createdAt: apiData.data.profile?.createdAt,
                    profileUrl: `https://talent.app${apiData.relativePath}`
                },
                
                scores: {
                    builder: apiData.data.profile?.builderScore,
                    allScores: apiData.data.profile?.scores,
                    level: getBuilderScoreLevel(apiData.data.profile?.builderScore?.points)
                },
                
                activity: {
                    dataPoints: apiData.data.dataPoints,
                    events: {
                        total: apiData.data.events?.length || 0,
                        recent: apiData.data.events?.slice(0, 10) || [],
                        timeline: processEventsTimeline(apiData.data.events)
                    },
                },
                
                credentials: {
                    all: apiData.data.credentials,
                    count: apiData.data.credentials?.length || 0,
                    byCategory: groupCredentialsByCategory(apiData.data.credentials)
                },
                
                connections: {
                    accounts: apiData.data.accounts,
                    socials: apiData.data.socials,
                    totalConnections: (apiData.data.accounts?.length || 0) + (apiData.data.socials?.length || 0)
                },
                
                projects: {
                    all: apiData.data.projects,
                    count: apiData.data.projects?.length || 0
                },
                
                yearInReview: wrappedStats,
                
                metadata: {
                    generatedAt: new Date().toISOString(),
                    dataSources: {
                        api: true,
                        profileScraping: scrapedProfile.success,
                        scoresScraping: scrapedScores.success
                    },
                    year: new Date().getFullYear()
                }
            };

            return res.status(200).json(formatSuccess(wrappedData, 'Wrapped data fetched successfully'));
        
        } catch (error) {
            console.error('Error in getWrappedData:', error);
            return res.status(500).json(formatError('Internal server error', error.message));
        }
    }

    // Health check endpoint
    async healthCheck(req, res) {
        return res.status(200).json(formatSuccess({ 
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'Talent Protocol Wrapped API',
            version: '2.0'
        }, 'Service is running'));
    }
}

// Calculate year-in-review statistics
function calculateWrappedStats(data) {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01`);
    
    const stats = {
        year: currentYear,
        builderScoreGrowth: calculateScoreGrowth(data.events),
        topActivities: getTopActivities(data.events),
        milestones: extractMilestones(data.events, data.dataPoints),
        monthlyActivity: getMonthlyActivityBreakdown(data.events),
        mostActiveMonth: null,
        credentialsEarned: getCredentialsThisYear(data.credentials, yearStart),
        projectsLaunched: getProjectsThisYear(data.projects, yearStart),
        connectionsGrown: calculateConnectionGrowth(data.events)
    };

    // Find most active month
    if (stats.monthlyActivity) {
        stats.mostActiveMonth = Object.entries(stats.monthlyActivity)
            .reduce((max, [month, count]) => count > max.count ? { month, count } : max, { month: null, count: 0 });
    }

    return stats;
}

// Helper: Get builder score level
function getBuilderScoreLevel(points) {
    if (!points) return null;
    if (points >= 500) return { level: 6, name: 'Expert' };
    if (points >= 300) return { level: 5, name: 'Advanced' };
    if (points >= 150) return { level: 4, name: 'Proficient' };
    if (points >= 75) return { level: 3, name: 'Practitioner' };
    if (points >= 25) return { level: 2, name: 'Apprentice' };
    return { level: 1, name: 'Newcomer' };
}

// Helper: Calculate score growth
function calculateScoreGrowth(events) {
    if (!events || events.length === 0) return { growth: 0, percentage: 0 };

    // Filter score-related events
    const scoreEvents = events.filter(e => 
        e.event_type?.includes('score') || e.event_type?.includes('points')
    );
    
    if (scoreEvents.length < 2) return { growth: 0, percentage: 0 };
    
    const firstScore = scoreEvents[scoreEvents.length - 1]?.new_value || 0;
    const lastScore = scoreEvents[0]?.new_value || 0;
    const growth = lastScore - firstScore;
    const percentage = firstScore > 0 ? ((growth / firstScore) * 100).toFixed(1) : 0;
    
    return { growth, percentage };
}

// Helper: Get top activities
function getTopActivities(events) {
    if (!events || events.length === 0) return [];
    
    const activityCounts = {};
    events.forEach(event => {
        const type = event.event_type || 'unknown';
        activityCounts[type] = (activityCounts[type] || 0) + 1;
    });
    
    return Object.entries(activityCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([type, count]) => ({ type, count }));
}

// Helper: Extract milestones
function extractMilestones(events, dataPoints) {
    const milestones = [];
    
    // Check for significant events
    if (events && events.length > 0) {
        events.forEach(event => {
            if (event.event_type?.includes('first') || 
                event.event_type?.includes('milestone') ||
                event.significance === 'high') {
                milestones.push({
                    type: event.event_type,
                    date: event.created_at,
                    description: event.description
                });
            }
        });
    }
    
    // Check data points for milestones
    if (dataPoints) {
        if (dataPoints.onchain?.contracts_deployed_mainnet > 0) {
            milestones.push({
                type: 'contracts_deployed',
                count: dataPoints.onchain.contracts_deployed_mainnet,
                description: 'Deployed smart contracts to mainnet'
            });
        }
    }
    
    return milestones.slice(0, 10);
}

// Helper: Get monthly activity breakdown
function getMonthlyActivityBreakdown(events) {
    if (!events || events.length === 0) return null;
    
    const currentYear = new Date().getFullYear();
    const monthlyActivity = {};
    
    events.forEach(event => {
        const date = new Date(event.created_at);
        if (date.getFullYear() === currentYear) {
            const month = date.toLocaleString('default', { month: 'short' });
            monthlyActivity[month] = (monthlyActivity[month] || 0) + 1;
        }
    });
    
    return monthlyActivity;
}

// Helper: Get credentials earned this year
function getCredentialsThisYear(credentials, yearStart) {
    if (!credentials) return [];
    
    return credentials.filter(cred => {
        const earnedDate = new Date(cred.earned_at || cred.created_at);
        return earnedDate >= yearStart;
    });
}

// Helper: Get projects launched this year
function getProjectsThisYear(projects, yearStart) {
    if (!projects) return [];
    
    return projects.filter(proj => {
        const launchDate = new Date(proj.created_at);
        return launchDate >= yearStart;
    });
}

// Helper: Calculate connection growth
function calculateConnectionGrowth(events) {
    if (!events) return { newConnections: 0 };
    
    const connectionEvents = events.filter(e => 
        e.event_type?.includes('connection') || 
        e.event_type?.includes('follow') ||
        e.event_type?.includes('account_added')
    );
    
    return {
        newConnections: connectionEvents.length,
        platforms: [...new Set(connectionEvents.map(e => e.platform))].filter(Boolean)
    };
}

// Helper: Group credentials by category
function groupCredentialsByCategory(credentials) {
    if (!credentials) return null;
    
    const grouped = {
        identity: [],
        activity: [],
        skills: []
    };
    
    credentials.forEach(cred => {
        const category = cred.category?.toLowerCase() || 'skills';
        if (grouped[category]) {
            grouped[category].push(cred);
        }
    });
    
    return grouped;
}

// Helper: Process events timeline
function processEventsTimeline(events) {
    if (!events || events.length === 0) return null;
    
    return events.slice(0, 50).map(event => ({
        type: event.event_type,
        date: event.created_at,
        description: event.description,
        impact: event.points_change || 0
    }));
}


module.exports = new WrappedController();