# 🚀 ToolStack CRM - Complete Deployment Guide

## 📋 Table of Contents
1. [Local Development Setup](#local-development-setup)
2. [Production Deployment (VPS)](#production-deployment-vps)
3. [Docker Deployment](#docker-deployment)
4. [Post-Deployment](#post-deployment)
5. [Troubleshooting](#troubleshooting)

---

## 🖥️ LOCAL DEVELOPMENT SETUP

### Prerequisites
- Node.js v18+ & Yarn
- Python 3.9+
- MongoDB 4.4+
- Git

### Step 1: Clone & Install

```bash
cd /path/to/toolstack-crm

# Backend dependencies
cd backend
yarn install

# Frontend dependencies
cd ../frontend
yarn install
```

### Step 2: Configure Environment

```bash
# Backend .env
cd backend
cp .env.example .env

# Generate secure keys
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('COOKIES_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"

# Update backend/.env with generated keys
```

Edit `backend/.env`:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=toolstack_crm
JWT_SECRET=<your-generated-secret>
JWT_REFRESH_SECRET=<your-generated-secret>
COOKIES_ENCRYPTION_KEY=<your-64-char-hex-key>
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
CRM_PORT=8002
```

### Step 3: Create Admin Account

```bash
cd backend
yarn seed:admin
# Follow prompts or use .env values
```

### Step 4: Start Services

**Terminal 1: MongoDB**
```bash
# If using local MongoDB
mongod --dbpath /path/to/data

# OR if using Docker
docker run -d -p 27017:27017 --name mongo mongo:7.0
```

**Terminal 2: Backend CRM**
```bash
cd backend
yarn start
# Server runs on http://localhost:8002
```

**Terminal 3: FastAPI Gateway** (Optional)
```bash
cd backend
pip install -r requirements.txt
python server.py
# Gateway runs on http://localhost:8001
```

**Terminal 4: Frontend**
```bash
cd frontend
yarn start
# Frontend runs on http://localhost:3000
```

### Step 5: Verify Local Setup

Open browser and test:
- **Website**: http://localhost:3000
- **Admin Login**: http://localhost:3000/admin/login
  - Email: admin@toolstack.com
  - Password: Admin123!Secure (or what you set in seed script)
- **Client Login**: http://localhost:3000/client/login
- **Tools Page**: http://localhost:3000/tools
- **Pricing Page**: http://localhost:3000/pricing

✅ **All routes should load without errors**

---

## 🌍 PRODUCTION DEPLOYMENT (VPS)

### Prerequisites
- Ubuntu 20.04+ VPS
- Domain name pointing to VPS IP
- SSH access
- Minimum 2GB RAM, 2 CPU cores

### Step 1: Prepare VPS

```bash
# SSH into VPS
ssh root@your-vps-ip

# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs

# Install Yarn
npm install -g yarn

# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

# Install Nginx
apt install -y nginx

# Install Certbot (for SSL)
apt install -y certbot python3-certbot-nginx

# Install PM2 (process manager)
npm install -g pm2
```

### Step 2: Upload Code

```bash
# On your local machine
rsync -avz --exclude 'node_modules' --exclude '.git' \
  /path/to/toolstack-crm root@your-vps-ip:/var/www/

# OR use Git
ssh root@your-vps-ip
cd /var/www
git clone https://github.com/yourusername/toolstack-crm.git
cd toolstack-crm
```

### Step 3: Configure Backend

```bash
cd /var/www/toolstack-crm/backend

# Install dependencies
yarn install --production

# Configure environment
cp .env.example .env
nano .env
```

Update `.env` with production values:
```env
MONGO_URL=mongodb://localhost:27017
DB_NAME=toolstack_crm_prod
JWT_SECRET=<generate-strong-secret>
JWT_REFRESH_SECRET=<generate-strong-secret>
COOKIES_ENCRYPTION_KEY=<generate-64-hex-chars>
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
CRM_PORT=8002
NODE_ENV=production
```

### Step 4: Create Admin

```bash
cd /var/www/toolstack-crm/backend
yarn seed:admin
```

### Step 5: Start Backend with PM2

```bash
# Start CRM backend
cd /var/www/toolstack-crm/backend
pm2 start server-crm.js --name toolstack-crm

# Save PM2 configuration
pm2 save
pm2 startup
```

### Step 6: Build Frontend

```bash
cd /var/www/toolstack-crm/frontend

# Install dependencies
yarn install

# Create production .env
echo "REACT_APP_BACKEND_URL=https://yourdomain.com" > .env

# Build
yarn build
```

### Step 7: Configure Nginx

```bash
nano /etc/nginx/sites-available/toolstack
```

Add this configuration:
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/toolstack-crm/frontend/build;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API proxy to Node.js backend
    location /api/ {
        proxy_pass http://localhost:8002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    # React Router SPA support
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/toolstack /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 8: Setup SSL with Let's Encrypt

```bash
# Obtain SSL certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
certbot renew --dry-run
```

Certbot will automatically update nginx config for HTTPS.

### Step 9: Setup Firewall

```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

### Step 10: Verify Production Deployment

Visit:
- https://yourdomain.com (Website)
- https://yourdomain.com/admin/login (Admin Portal)
- https://yourdomain.com/client/login (Client Portal)

---

## 🐳 DOCKER DEPLOYMENT

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+

### Step 1: Prepare Environment

```bash
cd /path/to/toolstack-crm

# Copy and configure environment
cp .env.example .env
nano .env
```

Update `.env`:
```env
DOMAIN=yourdomain.com
SSL_EMAIL=your-email@example.com
JWT_SECRET=<generate-strong-secret>
JWT_REFRESH_SECRET=<generate-strong-secret>
COOKIES_ENCRYPTION_KEY=<generate-64-hex-chars>
REACT_APP_BACKEND_URL=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
CORS_ORIGINS=https://yourdomain.com
MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=<strong-password>
```

### Step 2: Build and Start

```bash
# Build all services
docker-compose build

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Step 3: Create Admin

```bash
# Access backend container
docker-compose exec backend-crm sh

# Run seed script
cd /app
node scripts/seed-admin.js

# Exit container
exit
```

### Step 4: Setup SSL

```bash
# Obtain certificate
docker-compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/html \
  --email your-email@example.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com

# Restart frontend to use SSL
docker-compose restart frontend
```

### Step 5: Verify

Visit https://yourdomain.com

---

## 📊 POST-DEPLOYMENT

### Health Checks

```bash
# Check backend health
curl https://yourdomain.com/api/crm/health

# Check MongoDB
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check PM2 (if not using Docker)
pm2 status
pm2 logs toolstack-crm
```

### Monitoring

```bash
# Enable PM2 monitoring (if not using Docker)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Setup log monitoring
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Backups

```bash
# Backup MongoDB
mongodump --out /backup/$(date +%Y%m%d)

# Backup uploaded files (if any)
tar -czf /backup/uploads_$(date +%Y%m%d).tar.gz /var/www/toolstack-crm/uploads
```

### Updates

```bash
# Pull latest code
cd /var/www/toolstack-crm
git pull

# Backend updates
cd backend
yarn install --production
pm2 restart toolstack-crm

# Frontend updates
cd ../frontend
yarn install
yarn build
nginx -s reload
```

---

## 🔧 TROUBLESHOOTING

### Frontend not loading

```bash
# Check frontend build
ls -la /var/www/toolstack-crm/frontend/build

# Check nginx config
nginx -t

# Check nginx logs
tail -100 /var/log/nginx/error.log
```

### Backend errors

```bash
# Check PM2 logs
pm2 logs toolstack-crm

# Check backend health
curl http://localhost:8002/api/crm/health

# Restart backend
pm2 restart toolstack-crm
```

### MongoDB connection issues

```bash
# Check MongoDB status
systemctl status mongod

# Check MongoDB logs
tail -100 /var/log/mongodb/mongod.log

# Restart MongoDB
systemctl restart mongod
```

### SSL certificate issues

```bash
# Renew certificate manually
certbot renew

# Check certificate expiry
certbot certificates
```

---

## 📞 Support

For issues:
1. Check logs: `pm2 logs` or `docker-compose logs`
2. Verify environment variables
3. Check firewall rules: `ufw status`
4. Verify MongoDB connection
5. Check nginx configuration: `nginx -t`

---

**Deployment completed! Your ToolStack CRM is now live! 🎉**
