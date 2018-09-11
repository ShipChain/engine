#!/bin/bash

# Copy ECS env vars into bash profile so they're available to SSH'd users
echo "export ENV=$ENV" >> /etc/profile
echo "export GETH_NODE=$GETH_NODE" >> /etc/profile
echo "export SERVICE=$SERVICE" >> /etc/profile
echo "export REDIS_URL=$REDIS_URL" >> /etc/profile
echo "export AWS_CONTAINER_CREDENTIALS_RELATIVE_URI=$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI" >> /etc/profile
sed -i -e "2iexport AWS_CONTAINER_CREDENTIALS_RELATIVE_URI=$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI\\" /usr/sbin/keymaker-get-public-keys
sed -i -e "2iexport AWS_CONTAINER_CREDENTIALS_RELATIVE_URI=$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI\\" /usr/local/bin/keymaker-create-account-for-iam-user

exec "$@"