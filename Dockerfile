FROM node:8.11.2-stretch

LABEL maintainer="Lucas Clay <lclay@shipchain.io>"

ENV LANG C.UTF-8
ENV PYTHONUNBUFFERED 1

RUN apt-get update -y && apt-get install -y libgmp3-dev libstdc++6 jq

# SUPPORT SSH FOR IAM USERS #
RUN apt-get update && apt-get -y install openssh-server python3-pip
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
ADD ./package-lock.json /app/
RUN npm install
ENV NODE_PATH /app/node_modules
ENV PATH $PATH:/app/node_modules/.bin

RUN mkdir -p /contracts/contracts/LOAD/1.0/
RUN mkdir -p /contracts/contracts/LOAD/1.0.2/
RUN mkdir -p /contracts/contracts/ShipToken/1.0/
WORKDIR /contracts
RUN wget https://s3.amazonaws.com/shipchain-contracts/index.json
RUN wget -O contracts/LOAD/1.0/compiled.bin https://s3.amazonaws.com/shipchain-contracts/contracts/LOAD/1.0/compiled.bin
RUN wget -O contracts/LOAD/1.0.2/compiled.bin https://s3.amazonaws.com/shipchain-contracts/contracts/LOAD/1.0.2/compiled.bin
RUN wget -O contracts/ShipToken/1.0/compiled.bin https://s3.amazonaws.com/shipchain-contracts/contracts/ShipToken/1.0/compiled.bin

WORKDIR /app

COPY . /app/

COPY ./compose/scripts/*.sh /
RUN chmod +x /*.sh
ENTRYPOINT ["/entrypoint.sh"]
