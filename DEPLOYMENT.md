# Deployment Guide

Three self-hosting paths: **Render + Vercel** (recommended), **single Render service**, or **Docker on a VPS**. Your Supabase database is already independent — no migration needed for any of these.

---

## Option A — Render (backend) + Vercel (frontend)

This is the cleanest setup for zero-maintenance hosting. Both services have generous free tiers.

### 1. Deploy the backend to Render

1. Push the repo to GitHub
2. Create a new **Web Service** on [Render](https://render.com)
3. Connect your GitHub repo
4. Set the following:

| Setting | Value |
|---|---|
| Environment | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Port | `5000` |

5. Add environment variables in the Render dashboard:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
APP_PASSWORD=your-family-password
NODE_ENV=production
```

6. Deploy. Note the service URL — it will look like `https://bieri-family-api.onrender.com`.

### 2. Deploy the frontend to Vercel

1. Create a new project on [Vercel](https://vercel.com)
2. Connect the same GitHub repo
3. Set the **Root Directory** to `.` (project root)
4. Set **Build Command** to `npm run build`
5. Set **Output Directory** to `dist/public`
6. Add one environment variable:

```
VITE_API_URL=https://bieri-family-api.onrender.com
```

7. Deploy. Your app will be live at `https://your-project.vercel.app`.

**Important:** Add your Vercel URL to the CORS allowed origins in `server/routes.ts` if you see CORS errors (Express 5 allows all origins by default, but you may want to restrict this).

---

## Option B — Single Render Service (simpler)

If you want one service, let Express serve the frontend too (the default behaviour).

1. Follow the Render steps above exactly — no `VITE_API_URL` needed
2. The Express server will serve the built `dist/public` files as static assets
3. The app will be available at your Render URL directly

Free tier Render services spin down after 15 minutes of inactivity and take ~30 seconds to cold-start. This is fine for family use. Upgrade to a paid instance ($7/month) for instant response.

---

## Option C — Docker on a VPS

Suitable for a Raspberry Pi, a DigitalOcean droplet, or any Linux server.

### Build and run

```bash
# Build the image
docker build -t bieri-family-hub .

# Run with environment variables
docker run -d \
  -p 5000:5000 \
  -e SUPABASE_URL=https://your-project.supabase.co \
  -e SUPABASE_ANON_KEY=eyJ... \
  -e APP_PASSWORD=your-family-password \
  -e NODE_ENV=production \
  --name family-hub \
  --restart unless-stopped \
  bieri-family-hub
```

### With docker-compose

```yaml
version: "3.8"
services:
  family-hub:
    build: .
    ports:
      - "5000:5000"
    environment:
      - SUPABASE_URL=https://your-project.supabase.co
      - SUPABASE_ANON_KEY=eyJ...
      - APP_PASSWORD=your-family-password
      - NODE_ENV=production
    restart: unless-stopped
```

### Reverse proxy (nginx)

Put nginx in front to handle HTTPS via Let's Encrypt:

```nginx
server {
    listen 443 ssl;
    server_name family.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/family.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/family.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Fresh Supabase Setup (new project)

If you ever need to start with a new Supabase project:

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor**
3. Paste the full contents of `migration.sql` and run it
4. Update `SUPABASE_URL` and `SUPABASE_ANON_KEY` in your deployment environment

All your app data (events, medical records, payments, etc.) is portable — just export from the old Supabase project and import to the new one via the Supabase dashboard.

---

## Updating the App

```bash
# Pull latest changes
git pull

# Rebuild
npm run build

# Restart (if running directly)
npm start

# Or rebuild Docker image
docker build -t bieri-family-hub . && docker restart family-hub
```

On Render and Vercel, every push to `main` triggers an automatic redeploy.
