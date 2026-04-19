FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

# Rebuild better-sqlite3 native module
RUN npm rebuild better-sqlite3

COPY . .
RUN npm run build

RUN mkdir -p /data

ENV DB_PATH=/data/wolf.db

CMD ["node", "dist/bot.js"]
