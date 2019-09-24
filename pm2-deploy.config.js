module.exports = {
  apps : [
    {
      name: 'engine-rpc',
      script: 'dist/rpc-server.js',


      instances: 1,
      instance_var: 'INSTANCE_ID',

      autorestart: true,

      restart_delay: 3000,
      kill_timeout: 3000,
      min_uptime: 5000,
      listen_timeout: 10000,

      watch: false,
    }
  ]
};
