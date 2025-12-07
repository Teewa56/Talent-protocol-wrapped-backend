const app = require('./src/app');
const config = require('./src/config');
const http = require('http');

const server = http.createServer(app);
const PORT = config.port;

server.listen(PORT, () => {
  console.log(` Talent Protocol Wrapped API running on port ${PORT}`);
  console.log(` Environment: ${config.nodeEnv}`);
  console.log(` Health check: http://localhost:${PORT}/api/health`);
});