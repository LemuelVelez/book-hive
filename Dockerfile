# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Optional: allow setting Vite env at build-time in Coolify (Build Args)
# Example Build Arg key: VITE_API_BASE_URL
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Install deps (prefer lockfile when available)
COPY package.json ./
# If you have a lockfile, uncomment the next line and make sure it's committed:
# COPY package-lock.json ./

RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copy app source and build
COPY . .
RUN npm run build


# ---- Runtime stage (static) ----
FROM nginx:1.27-alpine AS runtime

# SPA-friendly Nginx config (React Router refresh support)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Keep nginx in foreground
CMD ["nginx", "-g", "daemon off;"]