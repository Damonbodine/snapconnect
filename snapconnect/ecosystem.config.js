// PM2 ecosystem configuration for SnapConnect Bot Scheduler
// 
// To use:
// npm install -g pm2
// pm2 start ecosystem.config.js
// pm2 save
// pm2 startup

module.exports = {
  apps: [
    {
      name: 'snapconnect-bot-scheduler',
      script: 'npm',
      args: 'run bot:scheduler',
      cwd: '/Users/damonbodine/Boostme/snapconnect',
      
      // Process management
      instances: 1,
      autorestart: true,
      watch: false,
      
      // Environment
      env: {
        NODE_ENV: 'production'
      },
      
      // Logging
      log_file: './logs/bot-scheduler.log',
      out_file: './logs/bot-scheduler-out.log',
      error_file: './logs/bot-scheduler-error.log',
      log_type: 'json',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Memory and CPU
      max_memory_restart: '500M',
      node_args: '--max-old-space-size=512',
      
      // Restart conditions
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 5000,
      
      // Health monitoring
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true
    }
  ],
  
  deploy: {
    production: {
      user: 'ubuntu',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/snapconnect.git',
      path: '/home/ubuntu/snapconnect',
      'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production'
    }
  }
};