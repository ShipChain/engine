## Base image with node and entrypoint scripts ##
## =========================================== ##
FROM node:10.15.0-stretch-slim AS base

LABEL maintainer="Lucas Clay <lclay@shipchain.io>"

ENV LANG C.UTF-8

RUN mkdir /app
WORKDIR /app

COPY ./compose/scripts/*.sh /
RUN chmod +x /*.sh
ENTRYPOINT ["/entrypoint.sh"]


## Image with system dependencies for building ##
## =========================================== ##
FROM base AS build

RUN apt-get update && \
    apt-get -y install git python2.7-minimal make g++ && \
    apt-get autoremove --purge -y && \
    rm -rf /var/lib/apt/lists/*
ENV PYTHON /usr/bin/python2.7


## Image only used for production building ##
## ======================================= ##
FROM build AS prod

COPY package.json /app/
COPY yarn.lock /app/
COPY .yarnclean /app/

RUN yarn --prod

COPY . /app/


## Image with dev-dependencies ##
## =========================== ##
FROM build AS test

COPY package.json /app/
COPY yarn.lock /app/
COPY .yarnclean /app/

RUN yarn

COPY . /app/


## Image to be deployed to ECS with additional utils and no build tools ##
## ==================================================================== ##
FROM base AS deploy

# SUPPORT SSH FOR IAM USERS #
RUN apt-get update && apt-get -y install openssh-server python3-pip jq
RUN mkdir /var/run/sshd /etc/cron.d
RUN pip3 install keymaker
RUN keymaker install

# Configure public key SSH
RUN echo "AllowAgentForwarding yes" >> /etc/ssh/sshd_config
RUN echo "PasswordAuthentication no" >> /etc/ssh/sshd_config

RUN pip3 install awscli

# Copy production node_modules without having to install packages in build
COPY --from=prod /app /app
