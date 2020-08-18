module.exports = {
  apps : [
    {
      name: 'engine-rpc',
      script: 'rpc-server.ts',
      exec_interpreter: 'ts-node',
      exec_mode : "fork_mode",
      instances: 1,
      instance_var: 'INSTANCE_ID',

      autorestart: true,

      restart_delay: 3000,
      kill_timeout: 3000,
      min_uptime: 5000,
      listen_timeout: 10000,

      watch: [
        "rpc",
        "src",
        "config",
        "rpc-server.ts",
      ],
      watch_delay: 1000,
      ignore_watch : [
        "node_modules",
      ],
      watch_options: {
        "followSymlinks": false
      },
    },
  ]
};
