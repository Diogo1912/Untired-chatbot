# Untire Coach 🌿

An AI-powered chatbot providing gentle support for cancer-related fatigue. Built with a Node.js backend and vanilla JavaScript frontend, featuring natural conversational AI, crisis detection, personalized profiles, and interactive features like meditation videos and breathing exercises.

## ✨ Features

- **AI-Powered Conversations**: Dynamic, empathetic responses powered by OpenAI GPT-4o
- **User Authentication**: Secure login system with session management
- **Personalized Profiles**: Dynamic profile extraction from conversations
- **Fatigue Assessment**: Built-in quiz to assess fatigue levels
- **Agentic Features**: AI can suggest meditation videos and breathing exercises
- **Chat History**: Persistent conversation history with multiple chat threads
- **Crisis Detection**: Automatic safety monitoring with emergency resources
- **Customizable Behavior**: Choose between empathetic, practical, or encouraging AI styles
- **Admin Panel**: Admin users can manage videos, breathing exercises, and quiz questions
- **Mobile Responsive**: Works seamlessly on all devices

## 🏗️ Architecture

### Backend (`server.js`)
- **Express.js** server with security middleware
- **OpenAI API** integration with intelligent prompt engineering
- **SQLite Database** for user data, chats, and content
- **Session-based Authentication** with secure cookies
- **Crisis detection** for user safety
- **Rate limiting** and error handling
- **Static file serving** (single-file deployment)

### Frontend (`index.html`)
- **Vanilla JavaScript** with React via CDN
- **Claude-inspired UI** with clean message layout
- **Real-time chat** with typing indicators
- **Fallback responses** when backend unavailable
- **Local storage** for conversation persistence

### Database (`database.js`)
- **SQLite** database with automatic schema initialization
- **User management** with authentication
- **Profile system** with dynamic profile extraction
- **Chat and message storage**
- **Content library** (videos, breathing exercises, quiz questions)

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 16.0.0 or higher ([Download here](https://nodejs.org/))
- **npm** (comes with Node.js) or **yarn**
- **OpenAI API key** ([Get one here](https://platform.openai.com/api-keys))
- **Git** (optional, for cloning the repository)

## 🚀 Installation & Setup

### 1. Clone or Download the Repository

```bash
git clone https://github.com/Diogo1912/Untired-chatbot.git
cd Untired-chatbot
```

Or download the ZIP file and extract it.

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- `express` - Web server framework
- `openai` - OpenAI API client
- `sqlite3` - Database driver
- `dotenv` - Environment variable management
- `cors` - Cross-origin resource sharing
- `helmet` - Security headers
- `cookie-parser` - Cookie parsing middleware
- `nodemon` - Development auto-restart (dev dependency)

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
# Required: Your OpenAI API key
OPENAI_API_KEY=sk-your-api-key-here

# Optional: Server configuration
PORT=3003
NODE_ENV=development
FRONTEND_URL=http://localhost:3003
```

**Important**: Never commit your `.env` file to version control. It's already in `.gitignore`.

### 4. Initialize the Database

The database will be automatically created and initialized when you first run the server. The database file `untire_coach.db` will be created in the project root.

### 5. (Optional) Seed Initial Data

If you want to populate the database with sample content:

```bash
# Add sample videos
node addVideos.js

# Add sample breathing exercises
node seedBreathing.js

# Add fatigue quiz questions
node seedQuiz.js
```

### 6. (Optional) Create Admin Account

To create an admin user account:

```bash
node createAdmin.js
```

This creates an admin account with:
- Username: `James`
- Password: `James123`

You can modify `createAdmin.js` to create a different admin account.

## 🏃 Running Locally

### Development Mode (with auto-restart)

```bash
npm run dev
```

This uses `nodemon` to automatically restart the server when you make changes to files.

### Production Mode

```bash
npm start
```

### Access the Application

Once the server is running, open your browser and navigate to:

```
http://localhost:3003
```

(Or whatever port you configured in your `.env` file)

## 📁 Project Structure

```
Untired-chatbot/
├── server.js              # Main Express server and API endpoints
├── database.js            # Database operations and schema
├── profileExtractor.js    # AI-powered profile extraction from conversations
├── index.html             # Frontend application (single-page app)
├── package.json           # Node.js dependencies and scripts
├── .env                   # Environment variables (not in git)
├── .env.example           # Example environment file
├── .gitignore             # Git ignore rules
├── untire_coach.db        # SQLite database (auto-generated, not in git)
│
├── createAdmin.js         # Script to create admin user
├── addVideos.js           # Script to seed sample videos
├── seedBreathing.js       # Script to seed breathing exercises
├── seedQuiz.js            # Script to seed quiz questions
│
└── README.md              # This file
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user info

### Profile
- `GET /api/profile/:userId` - Get user profile
- `POST /api/profile/:userId` - Update user profile
- `GET /api/profile/:userId/should-ask-fatigue` - Check if fatigue should be asked
- `POST /api/profile/:userId/fatigue-asked` - Mark fatigue as asked
- `POST /api/profile/:userId/update-fatigue` - Update fatigue level

### Settings
- `GET /api/settings/:userId` - Get user settings
- `POST /api/settings/:userId` - Update user settings

### Chats
- `GET /api/chats/:userId` - Get all user chats
- `GET /api/chat/:chatId` - Get specific chat with messages
- `POST /api/chat` - Send message and get AI response
- `DELETE /api/chat/:chatId` - Delete a chat

### Content (Public)
- `GET /api/videos` - Get all videos (optionally filtered by category)
- `GET /api/breathing-exercises` - Get all breathing exercises
- `GET /api/fatigue-quiz/questions` - Get quiz questions
- `POST /api/fatigue-quiz/calculate` - Calculate fatigue level from quiz answers

### Admin (requires admin account)
- `POST /api/videos` - Add a video
- `POST /api/breathing-exercises` - Add a breathing exercise

### Utility
- `GET /api/health` - Server health check
- `POST /api/welcome-message` - Generate personalized welcome message

## 🎯 How It Works

### User Flow

1. **Registration/Login**: Users create an account or log in
2. **Profile Setup**: Users can optionally set up their profile (name, age, fatigue level)
3. **Fatigue Quiz**: Users can take a quiz to assess their fatigue level
4. **Chat**: Users start conversations with the AI coach
5. **Personalization**: The AI learns about users through conversations and updates their dynamic profile
6. **Content Suggestions**: When enabled, the AI can suggest meditation videos and breathing exercises

### AI Behavior

The AI coach is designed to:
- **Start conversations naturally** without rigid onboarding forms
- **Provide empathetic support** for cancer-related fatigue
- **Offer practical, evidence-based strategies** for energy management
- **Detect crisis situations** and provide immediate safety resources
- **Maintain conversation context** for personalized responses
- **Learn from conversations** to build a dynamic user profile
- **Adapt to fatigue levels** and adjust suggestions accordingly
- **Always emphasize** that it provides educational support, not medical advice

### Dynamic Profile Extraction

The system uses AI to analyze conversations and extract key information:
- Personal details (family, work, hobbies)
- Health-related information
- Emotional patterns and coping strategies
- Preferences and support systems
- Daily routines and challenges

This information is used to personalize future conversations.

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | Yes | - |
| `PORT` | Server port | No | 3003 |
| `NODE_ENV` | Environment mode (`development` or `production`) | No | `development` |
| `FRONTEND_URL` | CORS origin URL | No | `http://localhost:3003` |

### User Settings

Users can customize their experience:
- **Behavior Type**: Choose between `empathetic`, `practical`, or `encouraging`
- **Agentic Features**: Enable/disable AI suggestions for videos and breathing exercises
- **Chat Only Mode**: Disable all interactive features except chat

## 🔒 Security Features

- API keys stored securely on server-side (never exposed to client)
- Session-based authentication with secure HTTP-only cookies
- CORS protection for cross-origin requests
- Rate limiting to prevent abuse
- Helmet.js security headers
- Input validation and sanitization
- Crisis detection for user safety
- SQL injection protection via parameterized queries
- Password hashing using SHA-256

## 🛠️ Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with auto-restart
- `npm test` - Run tests (placeholder)

### Database Schema

The database includes the following tables:
- `users` - User accounts and authentication
- `sessions` - Active user sessions
- `profiles` - User profiles and dynamic profiles
- `user_settings` - User preferences
- `chats` - Chat threads
- `messages` - Chat messages
- `videos` - Meditation video library
- `breathing_exercises` - Breathing exercise library
- `fatigue_quiz_questions` - Quiz questions

### Customization

#### Changing the AI Personality

Edit the `generateSystemPrompt` function in `server.js` to modify:
- Communication style
- Expertise areas
- Response guidelines
- Safety protocols

#### UI Customization

Modify the CSS variables in `index.html`:
```css
:root {
    --bg-primary: #F5F0E6;      /* Background color */
    --accent-primary: #FF7A2F;   /* Brand color */
    --text-primary: #2C2C2C;     /* Text color */
    /* ... more variables */
}
```

## 🚨 Crisis Detection

The system automatically detects crisis-related keywords and:
- Provides immediate safety resources
- Shows emergency contact numbers
- Offers grounding exercises
- Prioritizes user safety over conversation flow

## 🔧 Troubleshooting

### Backend server not starting

- Check if Node.js 16+ is installed: `node --version`
- Verify dependencies are installed: `npm install`
- Check if the port is available (default: 3003)
- Check for errors in the console output
- Ensure `.env` file exists and contains `OPENAI_API_KEY`

### AI not responding

- Verify OpenAI API key in `.env` file
- Check server logs for API errors
- Ensure you have OpenAI API credits
- Verify your API key has access to GPT-4o model

### Database errors

- Ensure SQLite3 is properly installed: `npm install sqlite3`
- Check file permissions for `untire_coach.db`
- Delete `untire_coach.db` to reset the database (will recreate on restart)

### "Backend server unavailable"

- Make sure to start the server: `npm run dev` or `npm start`
- Check the Settings panel for server status
- Verify firewall isn't blocking the port
- Check browser console for CORS errors

### Authentication issues

- Clear browser cookies and try logging in again
- Check that sessions table exists in database
- Verify password hashing is working correctly

### Port already in use

If port 3003 is already in use:
- Change the `PORT` in your `.env` file
- Or stop the process using that port:
  ```bash
  # Find process using port 3003
  lsof -ti:3003
  
  # Kill the process (replace PID with actual process ID)
  kill -9 PID
  ```

## 📱 Mobile Support

The interface is fully responsive and includes:
- Touch-friendly message interface
- Optimized composer for mobile keyboards
- Proper viewport scaling
- Accessible navigation

## 🧪 Testing

Currently, there are no automated tests. To test manually:

1. Start the server: `npm run dev`
2. Open `http://localhost:3003` in your browser
3. Create an account or log in
4. Test various features:
   - Chat with the AI
   - Take the fatigue quiz
   - Update your profile
   - Try different behavior types
   - Test admin features (if logged in as admin)

## 📝 License

MIT License - feel free to use this for educational or research purposes.

## 🙏 Acknowledgments

- Inspired by Claude's conversational interface
- Built for supporting cancer patients and caregivers
- Focused on evidence-based fatigue management strategies
- Uses OpenAI GPT-4o for AI capabilities

## ⚠️ Important Disclaimer

**This application provides educational support and is not a substitute for professional medical care. Users experiencing medical emergencies should contact emergency services immediately.**

The AI coach is designed to complement, not replace, professional healthcare. Always consult with healthcare providers for medical advice.

---

## 📞 Support

For issues, questions, or contributions, please open an issue on the GitHub repository.

**Happy coding! 🌿**
