# Deployment Guide for Untire Coach

This guide provides detailed instructions for deploying Untire Coach to Railway with MongoDB.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Railway Setup](#railway-setup)
3. [MongoDB Configuration](#mongodb-configuration)
4. [Environment Variables](#environment-variables)
5. [Deployment](#deployment)
6. [Post-Deployment Setup](#post-deployment-setup)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Accounts
- ✅ [Railway Account](https://railway.app) (free tier available)
- ✅ [OpenAI Account](https://platform.openai.com) with API access
- ✅ [GitHub Account](https://github.com) (for code repository)

### Required Software (for local testing)
- Node.js 16 or higher
- Git
- MongoDB (local or cloud)

### Cost Estimates
- **Railway**: Free tier includes $5/month credit, typically sufficient for development
- **MongoDB on Railway**: ~$5-10/month for production
- **OpenAI API**: Varies by usage, estimate $10-50/month depending on traffic
  - GPT-4o: ~$0.005 per 1K tokens input, ~$0.015 per 1K tokens output
  - A typical conversation costs ~$0.01-0.05

## Railway Setup

### Step 1: Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **"New Project"**
3. Choose deployment method:

#### Option A: Deploy from GitHub (Recommended)
```bash
# Push your code to GitHub first
git add .
git commit -m "Prepare for deployment"
git push origin main
```

Then in Railway:
- Select **"Deploy from GitHub repo"**
- Authorize Railway to access your GitHub
- Select your repository
- Railway will automatically detect Node.js and deploy

#### Option B: Deploy using Railway CLI
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

### Step 2: Configure Build Settings

Railway will automatically detect:
- `package.json` for dependencies
- `railway.json` for Railway-specific config
- `nixpacks.toml` for build configuration

**No manual configuration needed** - files are already set up!

## MongoDB Configuration

### Option 1: MongoDB on Railway (Recommended)

1. In your Railway project, click **"New"**
2. Select **"Database"** → **"MongoDB"**
3. Railway will provision a MongoDB instance
4. Click on MongoDB service to view connection details
5. Copy the **Connection String** (looks like: `mongodb://...`)

**Connection String Format:**
```
mongodb://mongo:PORT_NUMBER/railway?authSource=admin
```

### Option 2: MongoDB Atlas (Alternative)

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster
3. Set up database user and password
4. Whitelist Railway IPs (or use `0.0.0.0/0` for all IPs)
5. Get connection string:
```
mongodb+srv://username:password@cluster.mongodb.net/untire-coach?retryWrites=true&w=majority
```

### Option 3: Local MongoDB (Development Only)
```
mongodb://localhost:27017/untire-coach
```

## Environment Variables

### Step 1: Add Variables in Railway

1. Click on your service in Railway
2. Go to **"Variables"** tab
3. Click **"New Variable"**
4. Add the following variables:

| Variable | Value | Required | Notes |
|----------|-------|----------|-------|
| `OPENAI_API_KEY` | `sk-...` | ✅ Yes | Get from OpenAI dashboard |
| `MONGODB_URI` | `mongodb://...` | ✅ Yes | From MongoDB service or Atlas |
| `NODE_ENV` | `production` | ✅ Yes | Enables production optimizations |
| `PORT` | `3003` | ⚠️ Optional | Railway auto-assigns if not set |

### Step 2: Get Your OpenAI API Key

1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Copy the key (starts with `sk-`)
4. Add billing information to OpenAI account
5. Set usage limits to avoid surprises

### Step 3: Verify Variables

After adding all variables:
```bash
# Using Railway CLI
railway variables
```

Or check in Railway dashboard under Variables tab.

## Deployment

### Automatic Deployment (GitHub)

Railway automatically deploys when you push to your main branch:

```bash
git add .
git commit -m "Update application"
git push origin main
```

Railway will:
1. Detect the push
2. Build the application
3. Run `npm install`
4. Start with `node server-mongo.js`
5. Provide a public URL

### Manual Deployment (CLI)

```bash
# Deploy current directory
railway up

# Follow logs
railway logs

# Open in browser
railway open
```

### Deployment Process

Railway will:
1. ✅ Install Node.js 18.x
2. ✅ Run `npm ci` to install dependencies
3. ✅ Copy `server-mongo.js`, `database-mongo.js`, and assets
4. ✅ Start server with `node server-mongo.js`
5. ✅ Assign a public URL

**Expected deployment time:** 2-3 minutes

## Post-Deployment Setup

### Step 1: Verify Deployment

1. Check Railway dashboard for deployment status
2. Look for green **"Active"** status
3. Click **"View Logs"** to see server output
4. You should see:
```
✅ MongoDB connected successfully
🌿 Untire Coach server running on port 3003
🔑 OpenAI API: Configured
```

### Step 2: Create Admin Account

#### Option A: Using Railway Web Terminal

1. In Railway dashboard, click on your service
2. Go to **"Settings"** → **"Deploy"**
3. Look for **"Run a Command"** or use **"Connect"** tab
4. Run:
```bash
node setupAdmin.js
```

Follow prompts to create admin credentials.

#### Option B: Using Railway CLI

```bash
railway run node setupAdmin.js
```

Enter your desired:
- Admin username
- Admin password

**IMPORTANT:** Save these credentials securely!

### Step 3: Seed Initial Data (Optional)

Add starter content:

```bash
# Using Railway CLI
railway run node seedBreathing.js
railway run node seedQuiz.js
railway run node addVideos.js
```

This adds:
- ✅ Default breathing exercises
- ✅ Fatigue assessment quiz questions
- ✅ Sample meditation videos

### Step 4: Access Your Application

Railway provides a URL like:
```
https://untire-coach-production.up.railway.app
```

Test these endpoints:
- **Main App**: `https://your-url.railway.app/`
- **Admin Console**: `https://your-url.railway.app/admin.html`
- **Health Check**: `https://your-url.railway.app/api/health`

### Step 5: Configure AI Settings

1. Go to admin console
2. Log in with admin credentials
3. Navigate to **AI Settings** tab
4. Review and customize:
   - System prompt
   - AI model (GPT-4o recommended)
   - Temperature (0.8 default)
   - Enabled tools
   - Accessible user fields

### Step 6: Create First User Account

1. In admin console, go to **User Management**
2. Enter username and password
3. Click **"Create User"**
4. Share credentials with user
5. User can now log in to main app

## Custom Domain (Optional)

### Add Custom Domain to Railway

1. Go to Railway project settings
2. Click **"Domains"**
3. Click **"Add Domain"**
4. Enter your custom domain (e.g., `coach.yourdomain.com`)
5. Railway provides DNS records

### Update DNS

Add these records to your domain:
```
Type: CNAME
Name: coach (or your subdomain)
Value: <provided-by-railway>.railway.app
```

DNS propagation takes 5-60 minutes.

## Troubleshooting

### Deployment Fails

**Error: "Cannot find module"**
```bash
# Ensure all files are committed
git status
git add .
git commit -m "Add missing files"
git push
```

**Error: "Port already in use"**
- Railway handles port assignment automatically
- Don't set PORT in code, use `process.env.PORT`

### MongoDB Connection Issues

**Error: "MongoServerError: Authentication failed"**
- Verify `MONGODB_URI` in Railway variables
- Check MongoDB service is running
- Ensure connection string format is correct

**Fix:**
```bash
# Test connection locally
MONGODB_URI="your-connection-string" node server-mongo.js
```

### OpenAI API Errors

**Error: "Invalid API key"**
- Verify `OPENAI_API_KEY` starts with `sk-`
- Check key is active in OpenAI dashboard
- Ensure billing is set up

**Error: "Rate limit exceeded"**
- OpenAI has rate limits for API requests
- Upgrade OpenAI plan or wait for limit reset
- Implement request queuing (future enhancement)

### Application Not Loading

1. **Check Railway logs:**
```bash
railway logs
```

2. **Common issues:**
   - MongoDB not connected: Check connection string
   - OpenAI errors: Verify API key
   - Build failed: Check package.json dependencies

3. **Test health endpoint:**
```bash
curl https://your-url.railway.app/api/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2024-...",
  "version": "2.0.0",
  "database": "MongoDB"
}
```

### Admin Account Issues

**Can't create admin account:**
```bash
# Connect to Railway database directly
railway connect

# Manually insert admin (MongoDB shell)
use untire-coach
db.users.insertOne({
  _id: "admin_001",
  username: "admin",
  password_hash: "hash_your_password_here",
  is_admin: true,
  created_at: new Date()
})
```

### Performance Issues

**Slow responses:**
- Check OpenAI API latency
- Verify MongoDB performance
- Review Railway metrics for resource usage
- Consider upgrading Railway plan

**High costs:**
- Monitor OpenAI usage in dashboard
- Set spending limits
- Optimize token usage (reduce max_tokens)
- Consider GPT-4o-mini for lower costs

## Monitoring & Maintenance

### Railway Metrics

Monitor in Railway dashboard:
- CPU usage
- Memory usage
- Request count
- Response times
- Error rates

### OpenAI Usage

Track in OpenAI dashboard:
- Token usage
- Cost per day
- Rate limits
- Error rates

### Database Monitoring

For Railway MongoDB:
- Storage usage
- Connection count
- Query performance

### Regular Maintenance

**Weekly:**
- Review error logs
- Check OpenAI costs
- Monitor user feedback

**Monthly:**
- Update dependencies (`npm update`)
- Review security advisories
- Backup database (if critical data)
- Check Railway billing

**Quarterly:**
- Security audit
- Performance optimization
- Feature updates
- User survey

## Backup & Recovery

### Database Backup

**MongoDB on Railway:**
```bash
# Export database
railway run mongodump --uri="$MONGODB_URI" --out=/backup

# Download backup
railway volume download /backup ./local-backup
```

**MongoDB Atlas:**
- Automatic backups included in paid tiers
- Manual exports via Atlas dashboard

### Restore from Backup

```bash
# Import to Railway MongoDB
railway run mongorestore --uri="$MONGODB_URI" /backup
```

### Application Backup

Entire application is in Git:
```bash
git clone <your-repo> untire-coach-backup
```

## Scaling

### Vertical Scaling (Railway)

1. Go to Railway project
2. Click on service
3. Upgrade plan for more resources
   - More CPU
   - More RAM
   - Higher request limits

### Horizontal Scaling

For high traffic:
- Railway Pro plan supports replicas
- Add load balancer
- Use Redis for session storage
- Implement caching layer

### Cost Optimization

**Reduce OpenAI costs:**
- Use GPT-4o-mini instead of GPT-4o
- Reduce max_tokens (e.g., 300 instead of 500)
- Implement response caching
- Batch similar requests

**Reduce Railway costs:**
- Start with Hobby plan ($5/month)
- Scale up only when needed
- Monitor usage regularly
- Use sleep mode for dev environments

## Security Best Practices

### Production Checklist

- ✅ HTTPS enabled (automatic on Railway)
- ✅ Environment variables for secrets
- ✅ Strong admin password
- ✅ MongoDB authentication
- ✅ Rate limiting (to be implemented)
- ✅ Input validation
- ✅ CORS properly configured
- ⚠️ Upgrade to bcrypt for passwords (recommended)
- ⚠️ Add CSRF protection (recommended)

### Regular Security Updates

```bash
# Check for vulnerabilities
npm audit

# Fix automatically if possible
npm audit fix

# Review and update
npm update
```

### Incident Response

If compromised:
1. Rotate all secrets (API keys, passwords)
2. Review access logs
3. Notify affected users
4. Update security measures
5. Document incident

## Support Resources

- **Railway**: https://docs.railway.app
- **MongoDB**: https://docs.mongodb.com
- **OpenAI**: https://platform.openai.com/docs
- **Node.js**: https://nodejs.org/docs

## Next Steps

After successful deployment:

1. ✅ Create admin account
2. ✅ Configure AI settings
3. ✅ Add initial users
4. ✅ Seed content (videos, exercises)
5. ✅ Test all features
6. ✅ Monitor for 24 hours
7. ✅ Gather user feedback
8. ✅ Iterate and improve

---

**Congratulations! Your Untire Coach is now live! 🎉**

For questions or issues, refer to the main [README.md](README.md) or create an issue in the repository.

