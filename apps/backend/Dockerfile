FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
ARG CACHE_BUSTER=1
COPY . .
RUN npm run build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev || npm install --only=production
# jsonwebtoken 9.0.2 valida `algorithm` con lodash.includes; este parche lo
# sustituye por indexOf. Es idempotente: si el patrón no está, no toca nada.
RUN node -e "const fs=require('fs');const p='node_modules/jsonwebtoken/sign.js';let s=fs.readFileSync(p,'utf8');const before=s; s=s.replace(/isValid:\s*includes\.bind\(null, SUPPORTED_ALGS\)/,'isValid: function (val) { return SUPPORTED_ALGS.indexOf(val) !== -1; }'); if(before!==s){fs.writeFileSync(p,s); console.log('Patched jsonwebtoken/sign.js');} else {console.log('No patch applied (pattern not found)');}"
COPY --from=build /app/dist ./dist
# Sin `COPY .env.example ./.env`: la configuración llega por variables de
# entorno reales, no por un archivo con secretos de ejemplo horneado en la imagen.
EXPOSE 3000
CMD ["node","dist/main.js"]
