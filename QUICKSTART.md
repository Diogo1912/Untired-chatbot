# Quick Start Guide - Untire Coach v2.0

Get up and running in 10 minutes!

## Prerequisites

- Node.js 16+ installed
- MongoDB installed locally OR MongoDB connection string ready
- OpenAI API key

## Local Development (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
Create `.env` file:
```env
OPENAI_API_KEY=sk-your-key-here
MONGODB_URI=mongodb://localhost:27017/untire-coach
NODE_ENV=development
PORT=3003
```

### 3. Start MongoDB
```bash
# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

### 4. Default Admin Account
The system automatically creates a default admin account on first run:
- **Username**: `admin`
- **Password**: `UntireAdmin2024!`

⚠️ **IMPORTANT**: Change this password after first login!

(Optional: Run `node setupAdmin.js` to create a custom admin account)

### 5. Seed Data (Optional)
```bash
node seedBreathing.js
node seedQuiz.js
node addVideos.js
```

### 6. Start Server
```bash
npm start
```

### 7. Access Application
- **User App**: http://localhost:3003
- **Admin Console**: http://localhost:3003/admin.html

## Railway Deployment (10 minutes)

### 1. Push to GitHub
```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Create Railway Project
1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose your repository

### 3. Add MongoDB Service
1. In Railway project, click "New"
2. Select "Database" → "MongoDB"
3. Copy the connection string

### 4. Set Environment Variables
In Railway dashboard → Variables:
```
OPENAI_API_KEY=sk-your-key-here
MONGODB_URI=mongodb://mongo:XXXXX/railway?authSource=admin
NODE_ENV=production
```

### 5. Deploy
Railway automatically deploys! Wait 2-3 minutes.

### 6. Default Admin Account
The system automatically creates a default admin account:
- **Username**: `admin`
- **Password**: `UntireAdmin2024!`

⚠️ **IMPORTANT**: Change this password immediately after first login!

Access admin console at: `https://your-app.up.railway.app/admin.html`

### 7. Access Your App
Railway provides URL like: `https://your-app.up.railway.app`

## First Steps After Setup

### As Admin

1. **Login to Admin Console**
   - Go to `/admin.html`
   - Use admin credentials

2. **Configure AI Settings**
   - Edit system prompt
   - Choose model (GPT-4o recommended)
   - Set temperature (0.8 default)
   - Enable tools you want

3. **Create First User**
   - Go to User Management tab
   - Enter username and password
   - Click "Create User"

4. **Add Content**
   - Add meditation videos (YouTube URLs)
   - Create breathing exercises
   - Content will be available to all users

### As User

1. **Login**
   - Go to main page
   - Use credentials from admin

2. **Complete Profile**
   - Fill out name, age, cancer type, etc.
   - Set typical fatigue level
   - Skip any fields if preferred

3. **Start Chatting**
   - Share your thoughts
   - AI adapts to your fatigue level
   - Get personalized support

4. **Use Tools**
   - Take fatigue quiz for assessment
   - Try breathing exercises
   - Watch suggested videos

5. **Manage Settings**
   - Choose AI behavior (empathetic/practical/encouraging)
   - Enable/disable features
   - Export conversations

## Common Tasks

### Update AI Prompt
1. Admin console → AI Settings
2. Edit "System Prompt"
3. Click "Save AI Settings"
4. Takes effect immediately

### Add Meditation Video
1. Admin console → Content Management
2. Enter video title
3. Paste YouTube URL
4. Select category
5. Click "Add Video"

### Create New User
1. Admin console → User Management
2. Enter username and password
3. Click "Create User"
4. Share credentials with user

### View Statistics
1. Admin console → Statistics
2. See total users, chats, messages
3. Check system health

### Export Conversation
1. In chat, click "Export"
2. Downloads as text file
3. Share with healthcare team

## Troubleshooting

### "Session expired or invalid"
- Clear cookies and log in again
- Check MongoDB is running

### "OpenAI API error"
- Verify API key in `.env` or Railway variables
- Check OpenAI account has credits
- Review server logs

### "Failed to connect to MongoDB"
- Ensure MongoDB is running
- Verify connection string
- Check firewall settings

### Videos not loading
- Verify YouTube URL is correct
- Check video allows embedding
- Try different video

### Admin can't create users
- Verify logged in as admin (not regular user)
- Check browser console for errors
- Ensure MongoDB is connected

## Next Steps

- Read [README.md](README.md) for comprehensive documentation
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment guide
- Check [AGENTIC_TOOLS.md](AGENTIC_TOOLS.md) to add new tools
- See [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) for technical details

## Support

- Create GitHub issues for bugs
- Check documentation for common questions
- Review server logs for errors
- Contact development team

---

**Ready to help users manage cancer fatigue! 💪**

**Important**: This is educational support, not medical advice. Users should always consult with their healthcare team.

