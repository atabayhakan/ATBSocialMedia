// Kalıcı çalıştırma (terminal kapansa/reboot olsa da hayatta kalır):
//   npm run start:prod   → build + pm2 start
//   npx pm2 logs         → canlı loglar
//   npx pm2 status       → durum
//   npm run stop:prod    → durdur
module.exports = {
  apps: [
    {
      name: 'atb-backend',
      cwd: './backend',
      script: 'dist/server.js',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_restarts: 10,
    },
    {
      name: 'atb-frontend',
      cwd: './frontend',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      env: { NODE_ENV: 'production' },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
