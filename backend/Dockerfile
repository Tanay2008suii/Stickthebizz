# -------------------------------------------------------------
# StickTheBizz Backend Dockerfile for Render / Railway / Cloud
# -------------------------------------------------------------

FROM node:20-alpine

WORKDIR /app

# Install OpenSSL (includes libssl1.1) - available in Alpine repos
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 8000
CMD ["npm", "start"]
