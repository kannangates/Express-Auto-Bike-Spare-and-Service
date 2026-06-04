# Express Auto Bike Management System

A full-stack web app for managing a bike spare parts shop — inventory, orders, returns, barcode scanning, reports, and more.

---

## Table of Contents

1. [What You Need](#what-you-need)
2. [Three Modes — Pick One](#three-modes--pick-one)
3. [First-Time Setup](#first-time-setup)
4. [Daily Use](#daily-use)
5. [Google Drive Backups](#google-drive-backups)
6. [Moving to a Server Later](#moving-to-a-server-later)
7. [Troubleshooting](#troubleshooting)

---

## What You Need

- **Docker Desktop** — [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/)
- **Terminal** (Mac: Terminal app · Windows: PowerShell · Linux: any terminal)
- That's it for local/tunnel mode. Server mode also needs a domain name.

---

## Three Modes — Pick One

Everything is controlled by one setting in your `.env` file: `DEPLOYMENT_MODE`

| Mode | `DEPLOYMENT_MODE=` | Who can access | Cost |
|------|--------------------|----------------|------|
| **Local** — coding & testing on your laptop | `development` | Only you | Free |
| **Shop/Tunnel** — shop PC, staff & customers use it | `tunnel` | Anyone with the URL | Free |
| **Server** — VPS with your own domain | `server` | Anyone on the internet | ~$6/month |

### How the app knows which mode to use

`deploy.sh` reads `DEPLOYMENT_MODE` from `.env` and picks the matching Docker Compose file:

```
development  →  docker-compose.yml + docker-compose-local.yml
tunnel       →  docker-compose.yml + docker-compose-trycloudflare.yml
server       →  docker-compose.yml + docker-compose-server.yml
```

You never need to touch the Docker files directly — just change `DEPLOYMENT_MODE` in `.env`.

### Tunnel mode URL

When you run `./deploy.sh up` in tunnel mode, a free `trycloudflare.com` URL is generated automatically. That URL is stored in Redis and **shown as a banner inside the app** so all logged-in staff always know the current address. The URL changes each restart — the banner always shows the latest one.

---

## First-Time Setup

### Step 1 — Create your `.env` file

```bash
cp .env.example .env
```

Open `.env` in any text editor and set at minimum:

```bash
# For shop/tunnel mode (most common first use):
DEPLOYMENT_MODE=tunnel
POSTGRES_PASSWORD=choose-a-strong-password
SECRET_KEY=any-random-50-character-string
```

### Step 2 — Run first-time setup

```bash
./deploy-first-time.sh
```

This script does everything in order:
1. Installs `rclone` and links your Google Drive account (one browser sign-in)
2. Downloads the latest backup from Google Drive (if any exists)
3. Restores the database
4. Starts all services
5. Schedules a daily noon backup to Google Drive

**Options:**
```bash
./deploy-first-time.sh               # Full setup (recommended)
./deploy-first-time.sh gdrive-setup  # Re-link Google Drive only
./deploy-first-time.sh --fresh       # Skip restore, start with empty database
```

### Step 3 — Access the app

After `deploy-first-time.sh` finishes:

- **development**: open `http://localhost:3000`
- **tunnel**: the terminal shows a `trycloudflare.com` URL — share it with staff
- **server**: open `https://yourdomain.com`

---

## Daily Use

```bash
./deploy.sh up        # Start the app
./deploy.sh down      # Stop the app
./deploy.sh restart   # Restart all services
./deploy.sh backup    # Manual backup → Google Drive now
./deploy.sh logs      # View all logs
./deploy.sh logs backend   # View backend logs only
```

### Keeping the shop running (tunnel mode)

The shop PC must stay **on and connected to the internet**. The app and tunnel start automatically when you run `./deploy.sh up`. If the PC restarts, just run `./deploy.sh up` again — a new tunnel URL will appear in the app banner.

---

## Google Drive Backups

### How credentials are stored

When you run `./deploy-first-time.sh` for the first time, it opens a browser sign-in to your Google account. After you approve, `rclone` saves the credentials to `~/.config/rclone/rclone.conf` on that machine. You never need to sign in again on the same machine.

**On a new machine:** run `./deploy-first-time.sh gdrive-setup` — it opens the browser sign-in once and saves credentials for that machine.

### Backup schedule

- Runs every day at **12:00 noon** automatically (set up by `deploy-first-time.sh`)
- Keeps only the **latest backup** — one file locally, one file on Google Drive
- Stored in Google Drive folder: `ExpressAutoBikeBackups/`
- Backup log: `backups/backup.log`

### Manual backup

```bash
./deploy.sh backup
```

---

## Moving to a Server Later

When your friend is ready to pay for hosting (~$6/month on DigitalOcean, Hetzner, etc.):

### Step 1 — Get a server and domain

- Rent a VPS (any Linux server, 2GB RAM minimum)
- Buy a domain (cheapest: ~$10/year on Namecheap or Cloudflare Registrar)
- Point the domain's A record to your server IP at your DNS provider

### Step 2 — Set these in `.env`

```bash
DEPLOYMENT_MODE=server
FRONTEND_DOMAIN=yourdomain.com
BACKEND_DOMAIN=api.yourdomain.com
ACME_EMAIL=your-email@gmail.com       # For SSL certificate alerts
SECRET_KEY=generate-a-new-random-50-char-string
POSTGRES_PASSWORD=use-a-strong-password
DEBUG=0
```

### Step 3 — Open firewall ports

On your server, allow ports **80** and **443** (HTTP and HTTPS).

### Step 4 — Run first-time setup on the server

```bash
./deploy-first-time.sh
```

It will:
- Set up Google Drive access (re-link on the new machine)
- Download the latest backup from Google Drive
- Restore all shop data
- Start the app with Traefik handling SSL automatically (Let's Encrypt)

That's it — SSL certificate is provisioned automatically on first browser visit.

---

## Troubleshooting

### App won't start
```bash
./deploy.sh logs          # Check all logs
./deploy.sh logs backend  # Check Django errors
```

### Tunnel URL not showing in the app banner
```bash
./deploy.sh logs cloudflared   # Check if tunnel started
./deploy.sh restart            # Restart to get a fresh URL
```

### Database connection error
```bash
./deploy.sh logs postgres   # Check if postgres started
```

### Google Drive backup failing
```bash
cat backups/backup.log              # Check backup log
./deploy-first-time.sh gdrive-setup # Re-link Google Drive
```

### Reset everything (data will be lost)
```bash
docker-compose -f docker-compose.yml -f docker-compose-local.yml down -v
# Then re-run: ./deploy-first-time.sh --fresh
```

### Useful commands
```bash
./deploy.sh ps              # See which containers are running
./deploy.sh exec backend sh # Open a shell inside the backend container
```
