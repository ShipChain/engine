//this configuration is optional
//    "ES_TEST_NODE_URL" : "http://elasticsearch:920",

export default {
    "Storage": {
        "SFTP": {
            "SFTP_HOST": "localhost",
            "SFTP_PORT": 2222,
            "SFTP_USER": "shipchain_user",
            "SFTP_PASS": "shipchain_password",
            "SFTP_DRIVER_TESTS": false,
        },
        "S3": {
            "S3_ENDPOINT": "http://localhost:9099",
            "S3_BUCKET": "my-test-bucket",
            "S3_ACCESSKEY": "myMinioAccessKey",
            "S3_SECRETKEY": "myMinioSecretKey",
            "S3_DRIVER_TESTS": false,
        }
    },
    "DEPLOY_CONTRACTS" : true,
    "EVENT_CHUNK_SIZE" : 1,
}
