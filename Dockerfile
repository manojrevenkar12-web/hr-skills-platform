# syntax=docker/dockerfile:1
# One image: the NestJS API (with its run worker and the HR MCP endpoint) and the built console.
# Skill scripts are TypeScript run by Node's built-in type stripping (Node >= 22.18).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/hr-data/package.json packages/hr-data/
COPY packages/skill-kit/package.json packages/skill-kit/
COPY packages/hr-mcp/package.json packages/hr-mcp/
COPY packages/harness/package.json packages/harness/
COPY packages/evals/package.json packages/evals/
COPY apps/api/package.json apps/api/
COPY apps/console/package.json apps/console/
RUN npm ci
COPY . .
RUN npm run build && npx tsc -p apps/api && cd apps/console && npx vite build
RUN npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app /app
RUN rm -rf apps/console/src apps/console/node_modules/.vite \
 && node -e "const [a,b]=process.versions.node.split('.').map(Number); if (a===22 && b<18) { console.error('Node >= 22.18 needed for skill scripts'); process.exit(1) }" \
 && chown -R node:node /app/reports /app/registry
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
