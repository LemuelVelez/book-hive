# syntax=docker/dockerfile:1

############################
# 1) Install dependencies
############################
FROM node:20-alpine AS deps
WORKDIR /app

# Copy only package files first for better caching
COPY package.json ./
# If you have a lockfile, copy it too (any of these)
COPY package-lock.json* ./
COPY npm-shrinkwrap.json* ./

# Install deps (uses npm ci if lockfile exists)
RUN if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then npm ci; else npm install; fi

############################
# 2) Build the app
############################
FROM node:20-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build (your script runs: tsc -b && vite build)
RUN npm run build

############################
# 3) Serve with Nginx
############################
FROM nginx:1.27-alpine AS runner

# Replace default nginx site config
RUN rm -f /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built site
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]