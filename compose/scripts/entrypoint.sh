#!/bin/bash

if [ "$ENV" = "PROD" ] || [ "$ENV" = "DEMO" ] || [ "$ENV" = "STAGE" ] || [ "$ENV" = "DEV" ];
then
  /download-certs.sh
fi

# Run migrations
yarn run migrate
exec "$@"
