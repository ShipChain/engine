#!/bin/bash

if [[ "$ENV" = "PROD" ]] || [[ "$ENV" = "DEMO" ]] || [[ "$ENV" = "STAGE" ]] || [[ "$ENV" = "DEV" ]];
then
  /download-certs.sh
  yarn run migrate

else
    echo "Waiting for dependencies to come up in the stack"
    /wait-for-it.sh ${REDIS_NAME:-redis_db}:6379
    /wait-for-it.sh ${PSQL_NAME:-psql}:5432
    /wait-for-it.sh ${GETH_NAME:-geth-poa}:8545

    # Run migrations
    if [[ -z "$IS_DDO" ]];
    then
        yarn run migrate
    else
        echo "Skipping migrations"
    fi

fi


exec "$@"
