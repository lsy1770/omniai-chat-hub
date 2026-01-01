# ========================================
# omniai-chat-hub Dockerfile
# React + Vite 前端项目
# ========================================

# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
# Vite will use the base path configured in vite.config.ts (base: '/chat/')
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built files from builder stage to /chat subdirectory
# Vite builds with base: '/chat/', so assets are referenced as /chat/assets/xxx.js
COPY --from=builder /app/dist /usr/share/nginx/html/chat

# Create custom Nginx configuration
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    \
    # Serve /chat and /chat/* using root directive \
    location /chat { \
        root /usr/share/nginx/html; \
        try_files $uri $uri/index.html /chat/index.html; \
        index index.html; \
    } \
    \
    # Health check endpoint \
    location = /health { \
        access_log off; \
        return 200 "healthy\\n"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
