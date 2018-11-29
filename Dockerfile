FROM node:10.14.0-stretch

LABEL maintainer="Lucas Clay <lclay@shipchain.io>"

ENV LANG C.UTF-8
ENV PYTHONUNBUFFERED 1

# SUPPORT SSH FOR IAM USERS #
RUN apt-get update && apt-get -y install openssh-server python3-pip jq
RUN mkdir /var/run/sshd /etc/cron.d
RUN pip3 install keymaker
RUN keymaker install

# Configure public key SSH
RUN echo "AllowAgentForwarding yes" >> /etc/ssh/sshd_config
RUN echo "PasswordAuthentication no" >> /etc/ssh/sshd_config
# ------------------------- #

RUN pip3 install awscli

RUN mkdir /app
WORKDIR /app

ADD ./package.json /app/
ADD ./yarn.lock /app/
RUN yarn

COPY . /app/

COPY ./compose/scripts/*.sh /
RUN chmod +x /*.sh
ENTRYPOINT ["/entrypoint.sh"]
