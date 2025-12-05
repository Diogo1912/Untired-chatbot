# Untire Coach - AI Support for Cancer Fatigue

A compassionate AI chatbot designed to support individuals experiencing cancer-related fatigue through personalized conversations, evidence-based strategies, and practical tools.

## Features

### Core Features
- **Personalized AI Conversations**: Warm, empathetic support tailored to each user's fatigue level and treatment stage
- **Dynamic Profile Learning**: AI learns about users over time through conversation analysis
- **Multi-Modal Support**: Text conversations enhanced with videos, breathing exercises, and interactive tools
- **Memory System**: Card-based memory management for important insights and patterns
- **Secure Authentication**: Session-based authentication with admin controls

### User Features
- **Extended Profile System**: Capture cancer type, treatment stage, demographics, and more
- **Fatigue Tracking**: Daily fatigue level monitoring and trend analysis
- **Fatigue Assessment Quiz**: Validated questionnaire for accurate fatigue measurement
- **Conversation History**: Save and review past conversations
- **Chat Export**: Download conversations for sharing with healthcare providers
- **Customizable AI Behavior**: Choose empathetic, practical, or encouraging communication styles

### Admin Features
- **Admin Console** (`/admin.html`): Comprehensive dashboard for system management
- **AI Settings Configuration**:
  - Edit system prompt in real-time
  - Adjust AI model, temperature, and token limits
  - Control verbosity and behavior types
  - Enable/disable agentic tools
  - Configure accessible user information fields
  - Memory system controls
- **User Management**: Create, view, and manage user accounts
- **Content Management**: Add meditation videos and breathing exercises
- **System Statistics**: Monitor usage and health metrics

### Agentic Capabilities
- **Meditation Videos**: AI can suggest relevant guided meditation videos
- **Breathing Exercises**: Interactive breathing exercises for immediate relief
- **Journaling Prompts**: Guided reflection exercises (expandable)
- **Activity Tracking**: Help users track daily activities and energy (expandable)
- **Mood Tracking**: Monitor emotional well-being over time (expandable)

## Technology Stack

### Backend
- **Node.js** with Express.js
- **MongoDB**: Primary database (Railway-ready)
- **OpenAI API**: GPT-4o for intelligent conversations
- **Session-based Authentication**: Secure cookie-based sessions

### Frontend
- **Vanilla JavaScript**: No framework dependencies
- **Responsive Design**: Mobile-first approach
- **Modern CSS**: Clean, accessible interface

## Installation

### Prerequisites
- Node.js 16+
- MongoDB (local or cloud instance)
- OpenAI API key

### Local Development Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd "Untired chatbot prototype"
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
Create a `.env` file in the root directory:
```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/untire-coach

# Server Configuration
PORT=3003
NODE_ENV=development

# Session Configuration (optional, auto-generated if not set)
SESSION_SECRET=your_random_session_secret_here
```

4. **Start MongoDB** (if running locally)
```bash
# macOS (with Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

5. **Create the admin account**
```bash
node setupAdmin.js
```
Follow the prompts to create your admin username and password.

6. **Seed the database** (optional)
```bash
# Add breathing exercises
node seedBreathing.js

# Add quiz questions
node seedQuiz.js

# Add sample videos
node addVideos.js
```

7. **Start the server**
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

8. **Access the application**
- **User Interface**: http://localhost:3003
- **Admin Console**: http://localhost:3003/admin.html

## Railway Deployment

### Prerequisites
- Railway account (https://railway.app)
- MongoDB service on Railway (or MongoDB Atlas)

### Deployment Steps

1. **Install Railway CLI** (optional)
```bash
npm install -g @railway/cli
```

2. **Create a new Railway project**
- Go to Railway dashboard
- Click "New Project"
- Select "Deploy from GitHub repo" or "Empty Project"

3. **Add MongoDB service**
- In your Railway project, click "New"
- Select "Database" → "MongoDB"
- Copy the connection string (format: `mongodb://...`)

4. **Configure environment variables in Railway**
Go to your service → Variables and add:
```env
OPENAI_API_KEY=your_openai_api_key_here
MONGODB_URI=your_railway_mongodb_connection_string
NODE_ENV=production
PORT=3003
```

5. **Deploy**
- Railway will automatically detect `railway.json` and `nixpacks.toml`
- Push your code to GitHub and Railway will auto-deploy
- Or use Railway CLI: `railway up`

6. **Set up the admin account**
After first deployment, use Railway CLI or web terminal:
```bash
railway run node setupAdmin.js
```

7. **Access your deployed app**
- Railway will provide a URL like: `https://your-project.up.railway.app`
- Admin console: `https://your-project.up.railway.app/admin.html`

### Railway Configuration Files

The project includes:
- `railway.json`: Railway-specific configuration
- `nixpacks.toml`: Build configuration
- Both files are pre-configured for optimal deployment

## Usage Guide

### For End Users

1. **First Login**
   - Log in with credentials provided by admin
   - Complete your profile (cancer type, treatment stage, etc.)
   - Rate your current fatigue level

2. **Having Conversations**
   - Share your thoughts, concerns, or experiences
   - AI will provide empathetic support and practical strategies
   - AI adapts responses based on your fatigue level

3. **Using Tools**
   - AI may suggest meditation videos when you're stressed
   - Breathing exercises appear when you need quick relief
   - Take the fatigue quiz to update your fatigue level

4. **Managing Your Data**
   - Click your profile to view what AI knows about you
   - Review and delete saved memories
   - Export conversations to share with doctors
   - Clear all data if needed (irreversible)

5. **Customizing Experience**
   - Use Settings to change AI behavior (empathetic/practical/encouraging)
   - Enable or disable agentic features
   - Switch to chat-only mode for text-based support

### For Administrators

1. **Access Admin Console**
   - Navigate to `/admin.html`
   - Log in with admin credentials

2. **Configure AI Behavior**
   - **AI Settings Tab**:
     - Edit the system prompt to change AI personality
     - Adjust model (GPT-4o recommended)
     - Tune temperature (0.8 = balanced, lower = focused, higher = creative)
     - Set max response length
     - Choose verbosity level
     - Enable/disable tools (videos, breathing, journaling, etc.)
     - Control which user data fields AI can access

3. **Manage Users**
   - **User Management Tab**:
     - Create new user accounts
     - View all users and their creation dates
     - Delete users (except your own admin account)
     - Only admins can create accounts (users cannot self-register)

4. **Manage Content**
   - **Content Management Tab**:
     - Add meditation videos (YouTube)
     - Create breathing exercises
     - Videos automatically convert to embed format

5. **Monitor System**
   - **Statistics Tab**:
     - View total users, conversations, messages
     - Check database and API connection status
     - Monitor system health

## API Documentation

### Authentication Endpoints

```
POST /api/auth/login
Body: { username, password }
Response: { user: { id, username, isAdmin }, success: true }

POST /api/auth/logout
Response: { success: true }

GET /api/auth/me
Response: { user: { id, username, isAdmin } }
```

### Admin Endpoints (Require Admin Auth)

```
GET /api/admin/ai-settings
POST /api/admin/ai-settings
Body: { system_prompt, model, temperature, max_tokens, verbosity, enabled_tools, memory_enabled, accessible_user_fields }

GET /api/admin/users
POST /api/admin/users
Body: { username, password }

DELETE /api/admin/users/:userId

GET /api/admin/stats
```

### User Endpoints (Require Auth)

```
GET /api/profile/:userId
POST /api/profile/:userId
Body: { name, age, gender, ethnicity, cancer_type, treatment_stage, diagnosis_date, location, current_fatigue_level }

GET /api/settings/:userId
POST /api/settings/:userId
Body: { behavior_type, agentic_features, chat_only }

GET /api/chats/:userId
GET /api/chat/:chatId
POST /api/chat
Body: { chatId, message, initialFatigueLevel }
DELETE /api/chat/:chatId

GET /api/memories/:userId
POST /api/memories/:userId
Body: { title, content, category }
DELETE /api/memories/:memoryId
```

### Public Endpoints

```
GET /api/videos?category=meditation
GET /api/breathing-exercises
GET /api/fatigue-quiz/questions
POST /api/fatigue-quiz/calculate
Body: { answers: [{ questionId, selectedOption, optionValue }] }
```

## Architecture

### Database Schema (MongoDB)

**Collections:**
- `users`: User accounts with authentication
- `sessions`: Active user sessions
- `profiles`: Extended user profile information
- `user_settings`: Per-user AI behavior preferences
- `ai_settings`: Global AI configuration (admin-controlled)
- `chats`: Conversation threads
- `messages`: Individual messages with media attachments
- `saved_memories`: Card-based memory storage
- `videos`: Meditation video library
- `breathing_exercises`: Breathing exercise library
- `fatigue_quiz_questions`: Quiz questions and options

### AI System

The AI system uses a dynamic prompt generation approach:

1. **Base System Prompt**: Admin-configured core instructions
2. **User Context**: Injects profile data, fatigue level, demographics
3. **Dynamic Profile**: Learned information from past conversations
4. **Behavior Modifiers**: Adjusts tone based on user preferences
5. **Tool Context**: Provides available resources (videos, exercises)
6. **Conversation History**: Maintains context from recent messages

### Profile Learning System

The `profileExtractor.js` module uses GPT-4o to:
1. Analyze every 2-4 messages in a conversation
2. Extract key information (health details, preferences, patterns)
3. Update the dynamic profile with new insights
4. Preserve important context across sessions

### Memory System

The memory system operates at two levels:
1. **Automatic Dynamic Profile**: AI-generated summary from conversations
2. **Saved Memories**: User or AI can save important insights as cards
   - Each memory is a discrete card
   - Cards can be categorized
   - Users can delete memories individually

## Security Considerations

### Authentication
- Password hashing using SHA-256 (consider upgrading to bcrypt)
- HttpOnly cookies prevent XSS attacks
- Session expiration after 7 days
- CSRF protection via SameSite cookies

### Authorization
- Role-based access control (admin vs. user)
- User data isolation (users can only access their own data)
- Admin-only endpoints for system configuration

### Data Privacy
- Users can clear all their data at any time
- Conversations are private to each user
- No data sharing between users
- OpenAI API: conversations are not used for training (per OpenAI policy)

### Production Recommendations
1. Use HTTPS in production (Railway provides this automatically)
2. Upgrade to bcrypt for password hashing
3. Add rate limiting (express-rate-limit already in dependencies)
4. Implement CSRF tokens for state-changing operations
5. Regular security audits
6. Keep dependencies updated

## Troubleshooting

### Common Issues

**"Session expired or invalid"**
- Clear browser cookies and log in again
- Check server logs for session errors
- Verify MongoDB is running

**"OpenAI API error"**
- Verify API key in `.env`
- Check OpenAI account balance and rate limits
- Review server logs for detailed error messages

**"Failed to connect to MongoDB"**
- Ensure MongoDB is running
- Verify `MONGODB_URI` in `.env`
- Check MongoDB logs for connection issues

**Admin can't create users**
- Verify you're logged in as admin
- Check browser console for errors
- Ensure `is_admin` field is set correctly in database

**Videos not embedding**
- Verify YouTube URL format is correct
- Check if video is embeddable (some videos disable embedding)
- Test embed URL directly in browser

### Development Tips

**Enable debug logging:**
```javascript
// Add to server.js
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

**Test AI responses without API key:**
- Server falls back to demo responses when `OPENAI_API_KEY` is not set
- Useful for frontend development

**Reset database:**
  ```bash
# MongoDB
mongo untire-coach --eval "db.dropDatabase()"
```

## Contributing

### Code Style
- Use 2 spaces for indentation
- Semicolons required
- Use async/await over promises
- Comment complex logic

### Testing
- Test all user flows before committing
- Verify admin features work correctly
- Test mobile responsiveness
- Check error handling

### Pull Request Process
1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit PR with description of changes

## Future Enhancements

### Planned Features
- [ ] Enhanced journaling with prompts and tracking
- [ ] Activity and energy tracking graphs
- [ ] Mood tracking with visualizations
- [ ] Multi-language support
- [ ] Voice input/output
- [ ] Integration with health apps (Apple Health, Google Fit)
- [ ] Caregiver accounts
- [ ] Healthcare provider dashboard
- [ ] Evidence-based resource library
- [ ] Peer support community features

### AI Improvements
- [ ] Fine-tuned model specifically for cancer fatigue
- [ ] Multi-turn dialogue planning
- [ ] Proactive check-ins based on patterns
- [ ] Personalized intervention recommendations
- [ ] Integration with medical literature

### Technical Improvements
- [ ] Upgrade to bcrypt for passwords
- [ ] Add comprehensive test suite
- [ ] Implement WebSocket for real-time features
- [ ] Add caching layer (Redis)
- [ ] Migrate to TypeScript
- [ ] Add CI/CD pipeline
- [ ] Performance monitoring (e.g., New Relic, DataDog)

## License

MIT License - See LICENSE file for details

## Support

For issues, questions, or contributions:
- Create an issue in the repository
- Contact the development team
- Review existing documentation

## Acknowledgments

- OpenAI for GPT-4o API
- Cancer research community for fatigue management insights
- All users who provide feedback to improve the system

## Version History

### v2.0.0 (Current)
- Complete MongoDB migration
- Admin console with AI configuration
- Extended user profiles
- Card-based memory system
- Railway deployment support
- Enhanced agentic capabilities

### v1.0.0 (Initial)
- Basic chatbot functionality
- SQLite database
- User profiles and fatigue tracking
- Video and breathing exercise support
