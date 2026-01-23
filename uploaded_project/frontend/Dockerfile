# Stage 1: Build React App
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build arguments
ARG REACT_APP_BACKEND_URL
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL

# Build application
RUN yarn build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]