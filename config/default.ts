export default {
    "CONTRACT_FIXTURES_URL" : "https://s3.amazonaws.com/shipchain-contracts/meta.json",
    "DATABASE_URL" : "psql://engine:engine@psql:5432/engine",
    "DEPLOY_CONTRACTS" : true,
    "ELASTICSEARCH_URL" : undefined,
    "EVENT_CHUNK_SIZE" : 50,
    "GETH_NODE": undefined,
    "GPO_ETH_GAS_STATION" : false,
    "GPO_INTERVAL": null,
    "INFLUXDB_URL": undefined,
    "IS_DEPLOYED_STAGE" : false,
    "LOCAL_SECRET_KEY" : "0x0000000000000000000000000000000000000000000000000000000000000001",
    "LOGGING_LEVELS": {
        "CLOUDWATCH": "none",
        "DEFAULT": "debug",
        "ELASTICSEARCH": "none",
    },
    "REDIS_URL" : "redis://:redis_pass@redis_db:6379/1",
    "RPC_SERVER_PORT" : 2000,
    "RPC_SERVER_TIMEOUT": 270,
    "USE_JS_ORM_ENTITIES": false,
}
