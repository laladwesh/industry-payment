FROM node:20-alpine AS client-builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --legacy-peer-deps
COPY client/ ./
RUN npm run build

FROM node:20-alpine AS server-runtime

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

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
