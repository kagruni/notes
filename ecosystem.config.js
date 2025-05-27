module.exports = {
  apps: [
    {
      name: 'notes-app',
      script: './simple-server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3006
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3006
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-output.log',
      log_file: './logs/pm2-combined.log',
      log_date_format: 'YYYY-MM-DD HH:mm Z'
    }
  ]
}; 