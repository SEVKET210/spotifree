module.exports = {
  apps: [
    {
      name: 'spotifree-audio-proxy',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        ALLOWED_ORIGINS: 'https://spotifree.vercel.app,https://spotifree.pages.dev,http://localhost:3000',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
    },
  ],
};
