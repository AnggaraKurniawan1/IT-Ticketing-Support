FROM node:20-slim

WORKDIR /app

# Install build dependencies for better-sqlite3 / bcrypt if needed
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=7860
EXPOSE 7860

CMD ["node", "server.js"]
