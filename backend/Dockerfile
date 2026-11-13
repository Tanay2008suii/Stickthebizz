# -------------------------------------------------------------
# StickTheBizz Backend Dockerfile for Render / Railway / Cloud
# -------------------------------------------------------------

FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 8000
CMD ["npm", "start"]

