FROM node:16

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig*.json ./

RUN yarn install

COPY . ./

RUN yarn install

USER 1000
EXPOSE 4040

CMD ["yarn", "start"]
