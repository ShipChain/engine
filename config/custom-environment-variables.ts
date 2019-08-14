// https://github.com/lorenwest/node-config/wiki/Environment-Variables#custom-environment-variables

export default {
  "Storage": {
    "SFTP": {
      "SFTP_HOST": "SFTP_HOST",
      "SFTP_PORT": "SFTP_PORT",
      "SFTP_USER": "SFTP_USER",
      "SFTP_PASS": "SFTP_PASS",
      "SFTP_DRIVER_TESTS": "SFTP_DRIVER_TESTS"
    },
    "S3": {
      "S3_ENDPOINT": "S3_ENDPOINT",
      "S3_BUCKET": "S3_BUCKET",
      "S3_ACCESSKEY": "S3_ACCESSKEY",
      "S3_SECRETKEY": "S3_SECRETKEY",
      "S3_DRIVER_TESTS": "S3_DRIVER_TESTS"
    }
  },
  "GETH_NODE": "GETH_NODE",
  "ELASTICSEARCH_URL": "ELASTICSEARCH_URL",
  "INFLUXDB_URL": "INFLUXDB_URL",
  "REDIS_URL": "REDIS_URL",
  "DATABASE_URL": "DATABASE_URL",
  "USE_JS_ORM_ENTITIES": "USE_JS_ORM_ENTITIES",
}
