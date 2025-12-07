const talentApiService = require('../services/talentAPI.service');
const { formatSuccess, formatError } = require('../utils/response.formatter');

class WrappedController {
    async getWrappedData(req, res) {
        try {
            const { baseName } = req.params;

            if (!baseName) {
                return res.status(400).json(formatError('Base name is required'));
            }

            console.log(`\n Fetching wrapped data for: ${baseName}`);

            const apiData = await talentApiService.getComprehensiveWrappedData(baseName);

            if (!apiData.success) {
                return res.status(404).json(formatError('User not found', apiData.error));
            }

            const wrappedStats = calculateWrappedStats(apiData.data);

            const wrappedData = {
                user: {
                    id: apiData.data.profile?.id,
                    name: apiData.data.profile?.name,
                    displayName: apiData.data.profile?.displayName,
                    bio: apiData.data.profile?.bio,
                    imageUrl: apiData.data.profile?.imageUrl,
                    location: apiData.data.profile?.location,
                    tags: apiData.data.profile?.tags || [],
                    verified: {
                        human: apiData.data.humanCheckmark || false,
                        nationality: apiData.data.profile?.verifiedNationality || false
                    },
                    createdAt: apiData.data.profile?.createdAt,
                    profileUrl: `https://talent.app${apiData.relativePath}`,
                    socials: {
                        twitter: apiData.data.profile?.twitterHandle,
                        github: apiData.data.profile?.githubHandle,
                        farcaster: apiData.data.profile?.farcasterHandle
                    },
                    wallets: {
                        main: apiData.data.profile?.mainWallet,
                        verified: apiData.data.profile?.verifiedWallets || []
                    }
                },
                
                scores: {
                    builder: apiData.data.profile?.builderScore,
                    allScores: apiData.data.profile?.scores || [],
                    level: getBuilderScoreLevel(apiData.data.profile?.builderScore?.points),
                    detailed: apiData.data.allScores || {}
                },
                
                activity: {
                    events: {
                        total: apiData.data.events?.length || 0,
                        recent: apiData.data.events?.slice(0, 10) || [],
                        timeline: processEventsTimeline(apiData.data.events)
                    },
                    monthlyBreakdown: getMonthlyActivityBreakdown(apiData.data.events)
                },
                
                credentials: {
                    all: apiData.data.credentials || [],
                    count: apiData.data.credentials?.length || 0,
                    byCategory: groupCredentialsByCategory(apiData.data.credentials),
                    recent: (apiData.data.credentials || []).slice(0, 5)
                },
                
                connections: {
                    socials: apiData.data.socials || [],
                    accounts: apiData.data.accounts || [],
                    totalConnections: (apiData.data.socials?.length || 0) + (apiData.data.accounts?.length || 0)
                },
                
                projects: {
                    all: apiData.data.projects || [],
                    count: apiData.data.projects?.length || 0,
                    recent: (apiData.data.projects || []).slice(0, 5)
                },
                
                scrapedData: {
                    stats: apiData.data.scrapedStats || {},
                    activityFeed: apiData.data.activityFeed || [],
                    skills: apiData.data.skills || [],
                    achievements: apiData.data.achievements || []
                },
                
                yearInReview: wrappedStats,
                
                metadata: {
                    generatedAt: new Date().toISOString(),
                    dataSource: 'Talent Protocol API + Web Scraping',
                    year: new Date().getFullYear(),
                    dataAvailability: {
                        profile: true,
                        scores: true,
                        events: apiData.data.events?.length > 0,
                        credentials: apiData.data.credentials?.length > 0,
                        projects: apiData.data.projects?.length > 0,
                        scraping: apiData.data.scrapingSuccess
                    }
                }
            };

            console.log('Wrapped data generated successfully\n');

            return res.status(200).json(formatSuccess(wrappedData, 'Wrapped data fetched successfully'));
        
        } catch (error) {
            console.error('Error in getWrappedData:', error);
            return res.status(500).json(formatError('Internal server error', error.message));
        }
    }

    async healthCheck(req, res) {
        return res.status(200).json(formatSuccess({ 
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'Talent Protocol Wrapped API',
            version: '2.0'
        }, 'Service is running'));
    }
}

function calculateWrappedStats(data) {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(`${currentYear}-01-01`);
    
    return {
        year: currentYear,
        builderScoreGrowth: calculateScoreGrowth(data.events),
        topActivities: getTopActivities(data.events),
        milestones: extractMilestones(data.events, data.credentials),
        monthlyActivity: getMonthlyActivityBreakdown(data.events),
        mostActiveMonth: getMostActiveMonth(getMonthlyActivityBreakdown(data.events)),
        credentialsEarned: getCredentialsThisYear(data.credentials, yearStart),
        connectionsGrown: calculateConnectionGrowth(data.events),
        totalActivity: data.events?.length || 0
    };
}

function getBuilderScoreLevel(points) {
    if (!points) return { level: 1, name: 'Newcomer' };
    if (points >= 500) return { level: 6, name: 'Expert' };
    if (points >= 300) return { level: 5, name: 'Advanced' };
    if (points >= 150) return { level: 4, name: 'Proficient' };
    if (points >= 75) return { level: 3, name: 'Practitioner' };
    if (points >= 25) return { level: 2, name: 'Apprentice' };
    return { level: 1, name: 'Newcomer' };
}

function calculateScoreGrowth(events) {
    if (!events || events.length === 0) {
        return { growth: 0, percentage: 0, trend: 'stable' };
    }

    const scoreEvents = events.filter(e => 
        e.event_type?.toLowerCase().includes('score') || 
        e.event_type?.toLowerCase().includes('points')
    ).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    if (scoreEvents.length < 2) {
        return { growth: 0, percentage: 0, trend: 'new' };
    }
    
    const firstScore = scoreEvents[0]?.new_value || scoreEvents[0]?.value || 0;
    const lastScore = scoreEvents[scoreEvents.length - 1]?.new_value || scoreEvents[scoreEvents.length - 1]?.value || 0;
    const growth = lastScore - firstScore;
    const percentage = firstScore > 0 ? ((growth / firstScore) * 100).toFixed(1) : 0;
    const trend = growth > 0 ? 'growing' : growth < 0 ? 'declining' : 'stable';
    
    return { growth, percentage, trend };
}

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

function extractMilestones(events, credentials) {
    const milestones = [];
    const currentYear = new Date().getFullYear();
    
    if (events && events.length > 0) {
        events.forEach(event => {
            const eventDate = new Date(event.created_at);
            if (eventDate.getFullYear() === currentYear) {
                if (event.event_type?.toLowerCase().includes('milestone') || event.points_change > 10) {
                    milestones.push({
                        type: event.event_type,
                        date: event.created_at,
                        description: event.description || event.event_type,
                        impact: event.points_change || 0
                    });
                }
            }
        });
    }
    
    if (credentials && credentials.length > 0) {
        credentials.forEach(cred => {
            const credDate = new Date(cred.earned_at || cred.last_calculated_at);
            if (credDate.getFullYear() === currentYear) {
                milestones.push({
                    type: 'credential_earned',
                    date: cred.earned_at || cred.last_calculated_at,
                    description: `Earned ${cred.name || 'credential'}`
                });
            }
        });
    }
    
    return milestones.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
}

function getMonthlyActivityBreakdown(events) {
    if (!events || events.length === 0) return {};
    
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

function getMostActiveMonth(monthlyActivity) {
    if (!monthlyActivity || Object.keys(monthlyActivity).length === 0) return null;
    
    return Object.entries(monthlyActivity)
        .reduce((max, [month, count]) => 
            count > max.count ? { month, count } : max, 
            { month: null, count: 0 }
        );
}

function getCredentialsThisYear(credentials, yearStart) {
    if (!credentials || credentials.length === 0) return [];
    
    return credentials.filter(cred => {
        const earnedDate = new Date(cred.earned_at || cred.last_calculated_at);
        return earnedDate >= yearStart;
    });
}

function calculateConnectionGrowth(events) {
    if (!events || events.length === 0) {
        return { newConnections: 0, platforms: [] };
    }
    
    const connectionEvents = events.filter(e => {
        const type = (e.event_type || '').toLowerCase();
        return type.includes('connection') || type.includes('follow') || type.includes('account');
    });
    
    return {
        newConnections: connectionEvents.length,
        platforms: [...new Set(connectionEvents.map(e => e.platform || e.source))].filter(Boolean)
    };
}

function groupCredentialsByCategory(credentials) {
    if (!credentials || credentials.length === 0) return {};
    
    const grouped = {};
    
    credentials.forEach(cred => {
        const category = cred.category || 'other';
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push({
            name: cred.name || cred.slug,
            slug: cred.slug,
            earnedAt: cred.earned_at || cred.last_calculated_at
        });
    });
    
    return grouped;
}

function processEventsTimeline(events) {
    if (!events || events.length === 0) return [];
    
    return events.slice(0, 50).map(event => ({
        type: event.event_type,
        date: event.created_at,
        description: event.description || event.event_type,
        impact: event.points_change || 0
    }));
}

module.exports = new WrappedController();