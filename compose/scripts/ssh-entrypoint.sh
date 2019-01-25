#!/bin/bash

# Copy ECS env vars into bash profile so they're available to SSH'd users
echo "export ENV=$ENV" >> /etc/profile
echo "export CERT_AUTHORITY_ARN=$CERT_AUTHORITY_ARN" >> /etc/profile
echo "export GETH_NODE=$GETH_NODE" >> /etc/profile
echo "export SERVICE=$SERVICE" >> /etc/profile
echo "export REDIS_URL=$REDIS_URL" >> /etc/profile
echo "export AWS_CONTAINER_CREDENTIALS_RELATIVE_URI=$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI" >> /etc/profile
echo "cd /app" >> /etc/profile

/download-certs.sh

/usr/bin/ssh-keygen -A
/usr/bin/keymaker install
echo "auth include base-auth" >> /etc/pam.d/sshd
echo "account include base-account" >> /etc/pam.d/sshd
echo "session required pam_env.so" >> /etc/pam.d/sshd
sed -i 's/^keymaker/\/usr\/bin\/keymaker/' /usr/sbin/keymaker-get-public-keys
sed -i -e "2iexport AWS_CONTAINER_CREDENTIALS_RELATIVE_URI=$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI\\" /usr/sbin/keymaker-get-public-keys
sed -i -e "2iexport AWS_CONTAINER_CREDENTIALS_RELATIVE_URI=$AWS_CONTAINER_CREDENTIALS_RELATIVE_URI\\" /usr/bin/keymaker-create-account-for-iam-user
ln -s /usr/bin/keymaker-create-account-for-iam-user /usr/local/bin/keymaker-create-account-for-iam-user

exec "$@"