FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY backend/ ./
COPY lib/ /app/lib/
COPY db/migrations/ /app/db/migrations/
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node migrate.mjs && node --experimental-strip-types server.mjs"]
