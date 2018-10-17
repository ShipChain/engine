#!/bin/bash

if [ "$ENV" = "PROD" ] || [ "$ENV" = "STAGE" ] || [ "$ENV" = "DEV" ];
then
  /download-certs.sh
fi

# Run migrations
npm run migrate
exec "$@"