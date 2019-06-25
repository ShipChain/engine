export default {
    "REDIS_URL" : "redis://:redis_pass@redis_db:6379/1",
    "LOCAL_SECRET_KEY" : "0x0000000000000000000000000000000000000000000000000000000000000001",
    "EVENT_CHUNK_SIZE" : 50, 
    "LOGGING_LEVEL" : "info",
    "CLOUDWATCH_LEVEL" : "info",
    "ELASTICSEARCH_LEVEL" : "info",
    "RPC_SERVER_PORT" : 2000,
    "CONTRACT_FIXTURES_URL" : "https://s3.amazonaws.com/shipchain-contracts/meta.json",
    "DATABASE_URL" : "psql://engine:engine@psql:5432/engine",
    "IS_DEPLOYED_STAGE" : false,
    "GPO_ETH_GAS_STATION" : false,
    "DEPLOY_CONTRACTS" : true
}
