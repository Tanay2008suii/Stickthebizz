# -------------------------------------------------------------
# StickTheBizz Backend Dockerfile for Render / Railway / Cloud
# -------------------------------------------------------------

FROM node:20-bullseye-slim

WORKDIR /app

# Install OpenSSL 1.1 (required by Prisma)
RUN apt-get update -y && apt-get install -y openssl libssl1.1 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 8000
CMD ["npm", "start"]

