FROM node:18 AS deps
WORKDIR /app
# Copy package manifests and patch scripts so postinstall can run
COPY package.json package-lock.json* ./
# COPY scripts ./scripts
RUN npm ci || npm install
# Ensure jwt sign.js is patched even if lifecycle scripts are skipped
# RUN node scripts/postinstall-fix-jwt.cjs || true
# Fallback: apply patch via sed in case the node script didn't modify it
RUN sed -i "s/isValid: includes.bind(null, SUPPORTED_ALGS)/isValid: function (val) { return SUPPORTED_ALGS.indexOf(val) !== -1; }/" node_modules/jsonwebtoken/sign.js || true
RUN node -e "const fs=require('fs');const p='node_modules/jsonwebtoken/sign.js';let s=fs.readFileSync(p,'utf8');const before=s; s=s.replace(/isValid:\s*includes\.bind\(null, SUPPORTED_ALGS\)/,'isValid: function (val) { return SUPPORTED_ALGS.indexOf(val) !== -1; }'); if(before!==s){fs.writeFileSync(p,s); console.log('Patched jsonwebtoken/sign.js');} else {console.log('No patch applied (pattern not found)');}"

FROM node:18 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
ARG CACHE_BUSTER=1
COPY . .
RUN npm run build

FROM node:18 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev || npm install --only=production
# Ensure the jsonwebtoken patch is applied in the final image after install
RUN node -e "const fs=require('fs');const p='node_modules/jsonwebtoken/sign.js';let s=fs.readFileSync(p,'utf8');const before=s; s=s.replace(/isValid:\s*includes\.bind\(null, SUPPORTED_ALGS\)/,'isValid: function (val) { return SUPPORTED_ALGS.indexOf(val) !== -1; }'); if(before!==s){fs.writeFileSync(p,s); console.log('Patched jsonwebtoken/sign.js in runner stage');} else {console.log('No patch applied in runner stage (pattern not found)');}"
COPY --from=build /app/dist ./dist
COPY .env.example ./.env
EXPOSE 3000
CMD ["node","dist/main.js"]

