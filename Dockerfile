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
# Vite will use the base path configured in vite.config.ts
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html/chat

# Create custom Nginx configuration for SPA routing
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    \
    # Chat UI location \
    location /chat { \
        alias /usr/share/nginx/html/chat; \
        try_files $uri $uri/ /chat/index.html; \
        \
        # Add headers for security \
        add_header X-Frame-Options "SAMEORIGIN" always; \
        add_header X-Content-Type-Options "nosniff" always; \
        add_header X-XSS-Protection "1; mode=block" always; \
    } \
    \
    # Health check endpoint \
    location /health { \
        access_log off; \
        return 200 "healthy\\n"; \
        add_header Content-Type text/plain; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
