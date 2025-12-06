require('dotenv').config();

module.exports = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    talentProtocol: {
        apiUrl: process.env.TALENT_API_URL || 'https://api.talentprotocol.com',
        apiKey: process.env.TALENT_API_KEY,
    },
    
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true,
    }
};