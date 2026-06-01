FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY src/ ./src/
COPY airports.json ./airports.json

EXPOSE 3000

CMD ["npm", "start"]
