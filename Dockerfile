FROM node:10.15.0-stretch-slim

LABEL maintainer="Lucas Clay <lclay@shipchain.io>"

ENV LANG C.UTF-8
ENV PYTHONUNBUFFERED 1

# SUPPORT SSH FOR IAM USERS #
RUN apt-get update && apt-get -y install git openssh-server python2.7-minimal python3-pip jq
RUN mkdir /var/run/sshd /etc/cron.d
ENV PYTHON /usr/bin/python2.7
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
