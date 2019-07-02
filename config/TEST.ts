export default {
    "Storage": {
        "SFTP": {
            "SFTP_HOST": "localhost",
            "SFTP_PORT": 2222,
            "SFTP_USER": "shipchain_user",
            "SFTP_PASS": "shipchain_password",
            "SFTP_DRIVER_TESTS": false
        },
        "S3": {
            "S3_ENDPOINT": "http://localhost:9099",
            "S3_BUCKET": "my-test-bucket",
            "S3_ACCESSKEY": "myMinioAccessKey",
            "S3_SECRETKEY": "myMinioSecretKey",
            "S3_DRIVER_TESTS": false
        }
    },
    "REDIS_URL" : "redis://:redis_pass@redis_db:6379/1",
    "EVENT_CHUNK_SIZE" : 1, 
    "IS_DEPLOYED_STAGE" : false, 
    "DEPLOY_CONTRACTS" : true,

//this configuration is optional
//    "ES_TEST_NODE_URL" : "http://elasticsearch:920",

    "GETH_NODE" : "http://geth-poa:8545",
    "GPO_INTERVAL": 90000
}