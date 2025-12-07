const axios = require('axios');
const cheerio = require('cheerio');

class TalentScraperService {
    constructor() {
        this.baseURL = 'https://talent.app';
        this.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive'
        };
    }

    async scrapeProfile(username) {
        try {
            const cleanUsername = username.startsWith('/') ? username.slice(1) : username;
            const url = `${this.baseURL}/${cleanUsername}`;
            
            console.log(`Scraping: ${url}`);
            
            const response = await axios.get(url, { 
                headers: this.headers,
                timeout: 15000
            });

            const html = response.data;
            
            // Try to extract Next.js data first (most reliable)
            const nextData = this.extractNextData(html);
            
            let scrapedData;
            if (nextData) {
                console.log('Found structured data');
                scrapedData = this.parseNextData(nextData);
            } else {
                console.log('Parsing HTML');
                const $ = cheerio.load(html);
                scrapedData = this.parseHTML($);
            }

            console.log(`Projects: ${scrapedData.projects.length}, Skills: ${scrapedData.skills.length}`);
            
            return { success: true, data: scrapedData };

        } catch (error) {
            console.error('Scraping error:', error.message);
            return { success: false, error: error.message, data: this.getEmptyData() };
        }
    }

    extractNextData(html) {
        try {
            const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
            if (match) {
                const data = JSON.parse(match[1]);
                console.log('   📄 Next.js data structure:', Object.keys(data));
                if (data.props) console.log('      props keys:', Object.keys(data.props));
                if (data.props?.pageProps) console.log('      pageProps keys:', Object.keys(data.props.pageProps));
                return data;
            }
            return null;
        } catch (e) {
            console.error('Error parsing Next.js data:', e.message);
            return null;
        }
    }

    parseNextData(nextData) {
        try {
            const pageProps = nextData?.props?.pageProps || {};
            console.log('Available pageProps data:', Object.keys(pageProps));
            
            const profile = pageProps.profile || pageProps.user || pageProps.talent || pageProps;
            console.log('Profile data keys:', Object.keys(profile));
            
            // Try different possible keys for projects
            const projects = profile.projects || profile.portfolio || profile.works || 
                           pageProps.projects || pageProps.portfolio || [];
            
            console.log(`Found projects array:`, Array.isArray(projects), projects?.length || 0);
            
            return {
                projects: this.extractProjectsFromJSON(projects),
                skills: profile.skills || profile.tags || profile.interests || [],
                achievements: profile.achievements || profile.credentials || profile.badges || [],
                activityFeed: (profile.activities || profile.events || []).slice(0, 20),
                detailedStats: {
                    followers: profile.followers_count || profile.followersCount,
                    following: profile.following_count || profile.followingCount,
                    projects: profile.projects_count || profile.projectsCount
                }
            };
        } catch (e) {
            console.error('Error in parseNextData:', e.message);
            return this.getEmptyData();
        }
    }

    extractProjectsFromJSON(profile) {
        if (profile.projects && Array.isArray(profile.projects)) {
            return profile.projects.map(p => ({
                title: p.name || p.title,
                description: p.description,
                link: p.url || p.link,
                image: p.image || p.logo,
                tags: p.tags || [],
                createdAt: p.created_at
            }));
        }
        return [];
    }

    parseHTML($) {
        return {
            projects: this.extractProjects($),
            skills: this.extractSkills($),
            achievements: this.extractAchievements($),
            activityFeed: this.extractActivityFeed($),
            detailedStats: this.extractDetailedStats($)
        };
    }

    extractProjects($) {
        const projects = [];
        
        // Try many different possible selectors
        const projectSelectors = [
            '.project-card',
            '[data-testid="project-card"]',
            '[class*="Project"]',
            '[class*="project"]',
            '.portfolio-item',
            '[class*="Portfolio"]',
            'article[class*="project"]',
            'div[class*="project"][class*="card"]',
            'a[href*="/project"]'
        ];

        console.log('   🔍 Trying HTML project selectors...');

        projectSelectors.forEach(selector => {
            const found = $(selector);
            if (found.length > 0) {
                console.log(`      Found ${found.length} elements with selector: ${selector}`);
            }
            
            found.each((i, elem) => {
                const $elem = $(elem);
                
                // Try multiple ways to extract project data
                const project = {
                    title: this.extractText($elem, [
                        'h1', 'h2', 'h3', 'h4', 
                        '.title', '[class*="title"]', 
                        '.name', '[class*="name"]'
                    ]),
                    description: this.extractText($elem, [
                        'p', '.description', '[class*="description"]',
                        '.bio', '[class*="bio"]'
                    ]),
                    link: $elem.find('a').first().attr('href') || $elem.attr('href'),
                    image: this.extractImage($elem),
                    tags: this.extractTags($elem)
                };

                if (project.title && project.title.length > 2) {
                    console.log(`   Found project: ${project.title.substring(0, 50)}`);
                    projects.push(project);
                }
            });
        });

        console.log(`Total projects extracted from HTML: ${projects.length}`);
        return projects;
    }

    extractText($elem, selectors) {
        for (const selector of selectors) {
            const text = $elem.find(selector).first().text().trim();
            if (text && text.length > 0) return text;
        }
        return '';
    }

    extractImage($elem) {
        const img = $elem.find('img').first();
        return img.attr('src') || img.attr('data-src') || '';
    }

    extractTags($elem) {
        const tags = [];
        $elem.find('.tag, .badge, [class*="tag"], [class*="tech"]').each((i, tag) => {
            const tagText = $(tag).text().trim();
            if (tagText && tagText.length < 30) tags.push(tagText);
        });
        return tags;
    }

    extractSkills($) {
        const skills = [];
        $('[class*="skill"], [class*="tag"], .badge').each((i, elem) => {
            const skill = $(elem).text().trim();
            if (skill && skill.length < 50) skills.push(skill);
        });
        return [...new Set(skills)];
    }

    extractAchievements($) {
        const achievements = [];
        $('[class*="achievement"], [class*="credential"]').each((i, elem) => {
            const $elem = $(elem);
            const achievement = {
                title: $elem.find('h3, h4, strong').first().text().trim(),
                description: $elem.find('p').first().text().trim()
            };
            if (achievement.title) achievements.push(achievement);
        });
        return achievements;
    }

    extractActivityFeed($) {
        const activities = [];
        $('.activity-item, .timeline-item, .feed-item').each((i, elem) => {
            const $elem = $(elem);
            const activity = {
                type: $elem.find('[class*="type"]').text().trim(),
                description: $elem.find('p').first().text().trim(),
                date: $elem.find('time, [class*="date"]').text().trim()
            };
            if (activity.description) activities.push(activity);
        });
        return activities.slice(0, 20);
    }

    extractDetailedStats($) {
        const stats = {};
        $('[class*="stat"], [class*="metric"]').each((i, elem) => {
            const $elem = $(elem);
            const text = $elem.text();
            const number = text.match(/\d+/);
            if (number) {
                const context = $elem.parent().text().toLowerCase();
                if (context.includes('follower')) stats.followers = number[0];
                if (context.includes('following')) stats.following = number[0];
                if (context.includes('project')) stats.projects = number[0];
            }
        });
        return stats;
    }

    getEmptyData() {
        return {
            projects: [],
            skills: [],
            achievements: [],
            activityFeed: [],
            detailedStats: {}
        };
    }
}

module.exports = new TalentScraperService();