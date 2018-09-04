FROM node:8.11.2-stretch

LABEL maintainer="Lucas Clay <lclay@shipchain.io>"

ENV LANG C.UTF-8
ENV PYTHONUNBUFFERED 1

RUN apt-get update -y && apt-get install -y libgmp3-dev libstdc++6

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
RUN wget -O index.json https://s3.amazonaws.com/shipchain-contracts/index.json?versionId=null
RUN wget -O contracts/LOAD/1.0/compiled.bin https://s3.amazonaws.com/shipchain-contracts/contracts/LOAD/1.0/compiled.bin
RUN wget -O contracts/LOAD/1.0.2/compiled.bin https://s3.amazonaws.com/shipchain-contracts/contracts/LOAD/1.0.2/compiled.bin
RUN wget -O contracts/ShipToken/1.0/compiled.bin https://s3.amazonaws.com/shipchain-contracts/contracts/ShipToken/1.0/compiled.bin

WORKDIR /app

COPY . /app/

