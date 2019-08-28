export default {
    "DEPLOY_CONTRACTS" : false,
    "GETH_NETWORK" : "ropsten",
    "IS_DEPLOYED_STAGE" : true,
    "LOGGING_LEVELS": {
        "CLOUDWATCH": "debug",
        "DEFAULT": "info",
        "ELASTICSEARCH": "info",
    },
    "USE_JS_ORM_ENTITIES": true,
    "WEB3_OPTIONS": {
        "TRANSACTION_CONFIRMATION_BLOCKS": 24,
    },
}