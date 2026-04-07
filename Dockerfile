FROM node:20-alpine AS client-builder

WORKDIR /app
COPY package*.json ./
COPY client/package*.json ./client/
WORKDIR /app/client
RUN npm install --legacy-peer-deps
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS server-runtime

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY config ./config
COPY middleware ./middleware
COPY models ./models
COPY routes ./routes
COPY services ./services
COPY utils ./utils
COPY index.js ./index.js
COPY --from=client-builder /app/client/build ./client/build

RUN mkdir -p /app/uploads/payment-proofs

EXPOSE 5011

CMD ["node", "index.js"]
