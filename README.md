# Express Auto Bike Management System

## 📖 Complete Guide for Beginners

A complete web application for managing bike spare parts inventory and services. This guide explains everything step-by-step, even if you've never coded before.

---

## 🎯 Table of Contents

1. [What is This?](#what-is-this)
2. [What You Need](#what-you-need)
3. [Understanding Deployment Modes](#understanding-deployment-modes)
4. [Quick Start Guide](#quick-start-guide)
5. [Understanding the .env File](#understanding-the-env-file)
6. [Using the Deploy Script](#using-the-deploy-script)
7. [Backup and Restore](#backup-and-restore)
8. [Migrating to a Server](#migrating-to-a-server)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

---

## What is This?

This is a complete business management system for bike spare parts shops.

### Features You Get:
- ✅ **Inventory Management**: Track all your bike parts with barcodes
- ✅ **Order Processing**: Handle customer orders and payments
- ✅ **User Management**: Different access levels (Owner, Staff, Cashier, Delivery, Customer)
- ✅ **Barcode Scanning**: Use your phone camera to scan products
- ✅ **Reports**: Generate sales reports, inventory reports
- ✅ **Notifications**: Email alerts for low stock, order updates
- ✅ **Returns & Credits**: Handle product returns automatically
- ✅ **Mobile App**: Works on phones, tablets, computers
- ✅ **Offline Mode**: Works even without internet
- ✅ **Two Login Options**: Google login OR simple email/password

### What Makes It Special:
- **Zero Budget Option**: Run it for FREE on your laptop
- **Easy Upgrade**: Start free, upgrade to paid server later
- **Automatic Backups**: Your data is safe
- **One Configuration File**: Simple setup, no confusion

---

## What You Need

### Required Software:
1. **Docker Desktop** - Download from [docker.com](https://www.docker.com/products/docker-desktop/)
   - For Mac: Download Mac version
   - For Windows: Download Windows version
   - For Linux: Follow Linux installation guide

2. **Terminal/Command Prompt**
   - Mac: Use "Terminal" app (comes pre-installed)
   - Windows: Use "Command Prompt" or "PowerShell"
   - Linux: Use your terminal

### Optional (For Zero-Budget Hosting):
3. **Cloudflare Tunnel** - For free public access
   - Download from [github.com/cloudflare/cloudflared](https://github.com/cloudflare/cloudflared/releases)

---

## Understanding Deployment Modes

Think of deployment modes as different ways to run your shop:

### 🏠 Development Mode (Your Workshop)
**What it is:** Running on your computer for testing  
**Cost:** FREE  
**Who can access:** Only you (on your computer)  
**When to use:** When you're making changes or testing

**Example:**
```
You're sitting at your laptop testing the app.
Only you can see it at: http://localhost:3000
```

### 🌐 Production Mode (Your Real Shop)
**What it is:** Running on a rented server (VPS) with a domain name  
**Cost:** $10-50/month (server rental)  
**Who can access:** Anyone on the internet  
**When to use:** When you're ready for customers to use it

**Example:**
```
You rent a server and buy a domain: bikeshop.com
Anyone can visit: https://bikeshop.com
Professional setup with SSL (secure https)
```

### 🚇 Tunnel Mode (Your Shop with a Public Door)
**What it is:** Running on your laptop BUT accessible to everyone via a tunnel  
**Cost:** FREE (uses Cloudflare's free tunnel)  
**Who can access:** Anyone with the tunnel link  
**When to use:** Zero budget but need public access

**Example:**
```
You run it on your laptop (must stay on)
Cloudflare tunnel starts AUTOMATICALLY
You get a link: https://abc123.trycloudflare.com
Anyone can visit that link and use your app
Your laptop must stay on and connected to internet
```

### Which Mode Should You Choose?

| Your Situation | Best Mode | Why |
|----------------|-----------|-----|
| Just testing | Development | Free, easy, private |
| Zero budget, laptop always on | Tunnel | Free, public access |
| Have budget, want professional | Production | Fast, reliable, professional domain |
| Starting free, will upgrade later | Tunnel → Production | Start free, migrate when ready |

---

## Quick Start Guide

### Step 1: Download the Project
```bash
# If you have the project folder, open terminal and go to it:
cd /path/to/Express\ Auto\ Bike\ Spare\ and\ Service
```

### Step 2: Create Your Configuration File
```bash
# Copy the example file to create your own:
cp .env.example .env
```

### Step 3: Edit Your Configuration
Open the `.env` file with any text editor (Notepad, TextEdit, VS Code, etc.)

**For Development (Testing):**
```bash
DEPLOYMENT_MODE=development
```

**For Tunnel (Free Public Access):**
```bash
DEPLOYMENT_MODE=tunnel
DEBUG=0
```

**For Production (Paid Server):**
```bash
DEPLOYMENT_MODE=production
BACKEND_DOMAIN=api.yourdomain.com
FRONTEND_DOMAIN=yourdomain.com
ACME_EMAIL=your-email@example.com
SECRET_KEY=your-random-50-character-string
DEBUG=0
```

### Step 4: Start the Application
```bash
./deploy.sh
```

### Step 5: Initialize (First Time Only)
```bash
./deploy.sh init
```

This will:
- Set up the database
- Create your owner account
- Prepare everything

### Step 6: Access Your Application

**Development Mode:**
- Open browser: http://localhost:3000

**Tunnel Mode:**
- Run tunnel: `cloudflared tunnel --url http://localhost:3000`
- Copy the URL it gives you (like: https://abc123.trycloudflare.com)
- Share that URL with anyone

**Production Mode:**
- Open browser: https://yourdomain.com

---


## Understanding the .env File

The `.env` file is your configuration file. It's like a settings panel where you control everything.

### Important: There is Only ONE .env File

- Located at the root of your project
- All services (frontend, backend, database) read from this ONE file
- No need for multiple configuration files
- Easy to backup and manage

### Key Settings Explained

#### Deployment Mode
```bash
DEPLOYMENT_MODE=development
```
**What it does:** Tells the system how to run  
**Options:**
- `development` - For testing on your computer
- `tunnel` - For free public access via Cloudflare
- `production` - For professional server with domain

#### Database Settings
```bash
POSTGRES_DB=express_auto_bike
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```
**What it does:** Database login credentials  
**Important:** Change `POSTGRES_PASSWORD` in production!

#### Ports
```bash
BACKEND_PORT=8000
FRONTEND_PORT=3000
```
**What it does:** Which ports the app uses  
**Default:** Usually don't need to change these

#### Secret Key
```bash
SECRET_KEY=change-this-to-a-random-50-character-string-in-production
```
**What it does:** Encrypts your data  
**Important:** MUST change this in production!  
**How to generate:** Use a password generator or type random characters

#### Debug Mode
```bash
DEBUG=1
```
**What it does:** Shows detailed errors  
**Options:**
- `1` or `true` - Show errors (development only)
- `0` or `false` - Hide errors (production)

#### Google OAuth (Optional)
```bash
GOOGLE_OAUTH2_CLIENT_ID=
GOOGLE_OAUTH2_CLIENT_SECRET=
```
**What it does:** Enables "Login with Google" button  
**Optional:** Leave empty to use email/password only

#### Email Settings (Optional)
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
```
**What it does:** Sends email notifications  
**Optional:** Leave empty if you don't want email notifications

#### Production Settings
```bash
BACKEND_DOMAIN=api.yourdomain.com
FRONTEND_DOMAIN=yourdomain.com
ACME_EMAIL=your-email@example.com
```
**What it does:** Your domain names for production  
**Only needed:** When using production mode

#### Tunnel Settings
```bash
TUNNEL_FRONTEND_URL=https://abc123.trycloudflare.com
TUNNEL_BACKEND_URL=https://abc123.trycloudflare.com
```
**What it does:** Your Cloudflare tunnel URLs  
**Only needed:** When using tunnel mode  
**How to get:** Run `cloudflared tunnel --url http://localhost:3000`

### Security: Sensitive Values are Masked

When you run `./deploy.sh`, sensitive values are automatically hidden in the terminal:

**What you see:**
```
Configuration check:
  Database: express_auto_bike
  Secret Key: chan****
  DB Password: post****
  OAuth Secret: gocl****
```

**Why:** Prevents accidental exposure in screenshots or logs

---

## Using the Deploy Script

The `deploy.sh` script is your control panel. It does everything for you.

### Basic Commands

#### Start the Application
```bash
./deploy.sh
```
or
```bash
./deploy.sh up
```
**What it does:** Starts all services (database, backend, frontend)  
**When to use:** First time or after stopping

#### Stop the Application
```bash
./deploy.sh down
```
**What it does:** Stops all services  
**Auto-backup:** In production/tunnel mode, automatically backs up before stopping  
**When to use:** When you're done for the day

#### Restart the Application
```bash
./deploy.sh restart
```
**What it does:** Restarts all services  
**Auto-backup:** In production/tunnel mode, automatically backs up before restarting  
**When to use:** After changing .env file

#### Initialize (First Time Setup)
```bash
./deploy.sh init
```
**What it does:**
1. Sets up database tables
2. Creates your owner account

**When to use:** Only the first time, or after `./deploy.sh clean`

#### View Logs (See What's Happening)
```bash
./deploy.sh logs
```
**What it does:** Shows all activity from all services  
**When to use:** When something isn't working

**View specific service:**
```bash
./deploy.sh logs backend    # Backend only
./deploy.sh logs frontend   # Frontend only
./deploy.sh logs postgres   # Database only
```

#### Check Status
```bash
./deploy.sh ps
```
**What it does:** Shows which services are running  
**Output example:**
```
NAME                    STATUS    PORTS
express-auto-frontend   Up        0.0.0.0:3000->3000/tcp
express-auto-backend    Up        0.0.0.0:8000->8000/tcp
express-auto-postgres   Up        0.0.0.0:5432->5432/tcp
```

#### Get Help
```bash
./deploy.sh help
```
**What it does:** Shows all available commands

---

## Backup and Restore

### Why Backups Matter

Backups save:
- All your inventory data
- All customer orders
- All user accounts
- All uploaded images (product photos)
- Everything in your database

### Automatic Backups

**When they happen:**
- Before `./deploy.sh restart` (in production/tunnel mode)
- Before `./deploy.sh down` (in production/tunnel mode)
- Daily at 2 AM (if you set up scheduled backups)

**What gets backed up:**
- Database (all your data)
- Media files (product images, uploads)

**Where they're stored:**
- `./backups/` folder
- Named with timestamp: `db_backup_20260410_143022.sql`

**How long they're kept:**
- Last 7 days automatically
- Older backups are deleted automatically

### Manual Backup

**Create a backup right now:**
```bash
./deploy.sh backup
```

**What happens:**
1. Creates database backup: `backups/db_backup_20260410_143022.sql`
2. Creates media backup: `backups/media_backup_20260410_143022.tar.gz`
3. Shows you the file names

**Example output:**
```
ℹ Creating manual backup...
ℹ Backing up database...
✓ Database backed up: backups/db_backup_20260410_143022.sql
ℹ Backing up media files...
✓ Media files backed up: backups/media_backup_20260410_143022.tar.gz
✓ Backup completed!

Backup files:
  Database: backups/db_backup_20260410_143022.sql
  Media:    backups/media_backup_20260410_143022.tar.gz
```

### List All Backups

**See what backups you have:**
```bash
./deploy.sh list-backups
```

**Example output:**
```
Available backups:

Database backups:
  db_backup_20260410_143022.sql (2.3M)
  db_backup_20260409_020000.sql (2.1M)
  db_backup_20260408_020000.sql (2.0M)

Media backups:
  media_backup_20260410_143022.tar.gz (15M)
  media_backup_20260409_020000.tar.gz (14M)
  media_backup_20260408_020000.tar.gz (14M)

To restore a backup, use the timestamp:
  ./deploy.sh restore 20260410_143022
```

### Restore from Backup

**Restore your data from a backup:**
```bash
./deploy.sh restore 20260410_143022
```

**What happens:**
1. Asks for confirmation (because it will overwrite current data)
2. Restores database from backup
3. Restores media files from backup

**Example:**
```bash
$ ./deploy.sh restore 20260410_143022
⚠ This will overwrite current database and media files!
Are you sure? (yes/no): yes
ℹ Restoring database from backups/db_backup_20260410_143022.sql...
✓ Database restored successfully!
ℹ Restoring media files from backups/media_backup_20260410_143022.tar.gz...
✓ Media files restored successfully!
✓ Restore completed!
```

### Setup Scheduled Daily Backups

**Automatically backup every day at 2 AM:**
```bash
./deploy.sh schedule-backup
```

**What it does:**
- Creates a scheduled task (cron job)
- Runs backup every day at 2:00 AM
- Saves logs to `backups/backup.log`

**To remove scheduled backups:**
```bash
crontab -e
# Delete the line containing: deploy.sh backup
```

---

## Migrating to a Server

### Scenario: You've Been Running on Your Laptop for 6 Months

You started with tunnel mode (free) on your laptop. Now you want to move to a professional server.

**Good news:** All your data can be moved easily!

### Step-by-Step Migration

#### Step 1: Backup Everything on Your Laptop

```bash
# On your laptop
./deploy.sh backup
```

**What you get:**
- `backups/db_backup_20260410_143022.sql` (your database)
- `backups/media_backup_20260410_143022.tar.gz` (your images)

**Remember the timestamp:** `20260410_143022`

#### Step 2: Transfer Backups to Server

**From your laptop, run:**
```bash
# Replace with your server IP and path
scp backups/db_backup_20260410_143022.sql root@your-server-ip:/root/bikeshop/backups/
scp backups/media_backup_20260410_143022.tar.gz root@your-server-ip:/root/bikeshop/backups/
```

**What this does:** Copies your backup files to the server

#### Step 3: Setup and Restore on Server

**On your server, run:**
```bash
# 1. Copy .env.example to .env
cp .env.example .env

# 2. Edit .env for production
nano .env
# Change: DEPLOYMENT_MODE=production
# Change: BACKEND_DOMAIN=api.yourdomain.com
# Change: FRONTEND_DOMAIN=yourdomain.com
# Save and exit

# 3. Start the application
./deploy.sh

# 4. Restore your data
./deploy.sh restore 20260410_143022
```

**Done!** All your data is now on the server:
- All inventory items
- All orders
- All customers
- All user accounts
- All product images
- Everything!

---

## Troubleshooting

### Problem: Port Already in Use

**Error message:**
```
Error: Port 3000 is already in use
```

**Solution:**
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Kill the process using port 8000
lsof -ti:8000 | xargs kill -9

# Try again
./deploy.sh
```

### Problem: Can't Access http://localhost:3000

**Possible causes:**
1. Services haven't started yet (wait 2-3 minutes)
2. Docker isn't running
3. Port is blocked

**Solutions:**

**Check if services are running:**
```bash
./deploy.sh ps
```

**Check logs for errors:**
```bash
./deploy.sh logs
```

**Restart everything:**
```bash
./deploy.sh down
./deploy.sh
```

### Problem: Database Connection Error

**Error message:**
```
Could not connect to database
```

**Solution:**
```bash
# Check if postgres is running
./deploy.sh ps

# Check postgres logs
./deploy.sh logs postgres

# Restart
./deploy.sh restart
```

### Problem: Forgot Owner Password

**Solution:**
```bash
# Access backend shell
./deploy.sh exec backend sh

# Reset password
python manage.py changepassword your-email@example.com

# Exit shell
exit
```

### Problem: Tunnel URL Not Working

**Possible causes:**
1. Cloudflared not running
2. Wrong URL in .env file
3. Laptop went to sleep

**Solutions:**

**Check if cloudflared is running:**
- Look for the terminal window with cloudflared
- If closed, start it again:
```bash
cloudflared tunnel --url http://localhost:3000
```

**Update .env with new URL:**
- Copy the new tunnel URL
- Update `TUNNEL_FRONTEND_URL` and `TUNNEL_BACKEND_URL` in .env
- Restart: `./deploy.sh restart`

### Problem: Everything is Broken

**Nuclear option (starts fresh):**
```bash
# This deletes ALL data!
./deploy.sh clean

# Start fresh
./deploy.sh

# Initialize
./deploy.sh init
```

**If you have a backup:**
```bash
./deploy.sh clean
./deploy.sh
./deploy.sh restore 20260410_143022
```

---

## FAQ

### Q: Do I need to know coding?
**A:** No! Just follow the instructions. Copy, paste, run commands.

### Q: How much does it cost?
**A:** 
- Development mode: FREE
- Tunnel mode: FREE (but laptop must stay on)
- Production mode: $10-50/month for server

### Q: Can I start free and upgrade later?
**A:** Yes! Start with tunnel mode, migrate to production later. All data moves with you.

### Q: What if my laptop dies in tunnel mode?
**A:** Your data is safe if you have backups. Restore on a new laptop or server.

### Q: How do I add products?
**A:** Login → Inventory → Add Item → Scan barcode or enter manually

### Q: How do I add staff members?
**A:** Login as owner → Users → Add User → Choose role (Operations, Cashier, etc.)

### Q: Can customers place orders online?
**A:** Yes! They can register, browse products, place orders.

### Q: Do I need Google OAuth?
**A:** No, it's optional. Simple email/password works fine.

### Q: What if I lose my data?
**A:** If you have backups, you can restore everything. Always keep backups!

### Q: Can I use my phone?
**A:** Yes! It's a Progressive Web App (PWA). Works on phones, tablets, computers.

### Q: Does it work offline?
**A:** Yes! The app caches data and works offline. Syncs when back online.

### Q: How do I update the app?
**A:** 
```bash
git pull  # Get latest code
./deploy.sh restart  # Restart with new code
```

### Q: Can I customize it?
**A:** Yes, but you'll need a developer. The code is open and modifiable.

---

## Quick Reference Card

### Most Common Commands

```bash
# Start application
./deploy.sh

# Stop application
./deploy.sh down

# Restart application
./deploy.sh restart

# First time setup
./deploy.sh init

# Create backup
./deploy.sh backup

# List backups
./deploy.sh list-backups

# Restore backup
./deploy.sh restore 20260410_143022

# View logs
./deploy.sh logs

# Check status
./deploy.sh ps

# Get help
./deploy.sh help
```

### Important Files

```
.env                    # Your configuration (EDIT THIS)
.env.example            # Template (DON'T EDIT)
deploy.sh               # Control script (DON'T EDIT)
backups/                # Your backups (AUTO-CREATED)
backend/media/          # Uploaded images (AUTO-CREATED)
```

### Default Access URLs

```
Development:
  Frontend: http://localhost:3000
  Backend:  http://localhost:8000
  Admin:    http://localhost:8000/admin/

Production:
  Frontend: https://yourdomain.com
  Backend:  https://api.yourdomain.com
  Admin:    https://api.yourdomain.com/admin/

Tunnel:
  Frontend: https://your-tunnel-url.trycloudflare.com
  Backend:  https://your-tunnel-url.trycloudflare.com
  Admin:    https://your-tunnel-url.trycloudflare.com/admin/
```

---

## Summary

This system is designed to be:
- **Simple**: One configuration file, one deploy script
- **Flexible**: Start free, upgrade when ready
- **Safe**: Automatic backups, easy restore
- **Secure**: Passwords masked, SSL in production
- **Complete**: Everything you need for a bike shop

**Remember:**
1. There's only ONE `.env` file - keep it safe
2. Backups are automatic in production/tunnel mode
3. You can migrate from laptop to server anytime
4. All your data moves with you

**Need help?** Run `./deploy.sh help` or check the troubleshooting section above.

---

**Built with ❤️ for small businesses**

*Last updated: April 2026*
