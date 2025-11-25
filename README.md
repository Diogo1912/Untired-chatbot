# Untire Coach 🌿

An AI-powered chatbot providing gentle support for cancer-related fatigue. Built with a Node.js backend and vanilla JavaScript frontend, featuring natural conversational AI and crisis detection.

## ✨ Features

- **AI-Powered Conversations**: Dynamic, empathetic responses powered by OpenAI GPT-4
- **Natural Onboarding**: No rigid forms - the AI starts conversations naturally
- **Crisis Detection**: Automatic safety monitoring with emergency resources
- **Claude-Inspired Interface**: Clean, professional chat interface
- **Secure Backend**: API keys safely stored server-side
- **Conversation Memory**: Persistent chat history with export functionality
- **Mobile Responsive**: Works seamlessly on all devices

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- OpenAI API key ([get one here](https://platform.openai.com/api-keys))

### Installation

1. **Clone or download** this project
2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```

4. **Start the server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** to `http://localhost:3001`

That's it! The AI coach will greet you naturally and start the conversation.

## 🏗️ Architecture

### Backend (`server.js`)
- **Express.js** server with security middleware
- **OpenAI API** integration with intelligent prompt engineering
- **Crisis detection** for user safety
- **Rate limiting** and error handling
- **Static file serving** (single-file deployment)

### Frontend (`index.html`)
- **Vanilla JavaScript** with React via CDN
- **Claude-inspired UI** with clean message layout
- **Real-time chat** with typing indicators
- **Fallback responses** when backend unavailable
- **Local storage** for conversation persistence

### Key Endpoints
- `GET /api/health` - Server health check
- `POST /api/chat` - AI conversation endpoint
- `GET /*` - Serves the frontend application

## 🎯 AI Behavior

The AI coach is designed to:

- **Start conversations naturally** without rigid onboarding forms
- **Provide empathetic support** for cancer-related fatigue
- **Offer practical, evidence-based strategies** for energy management
- **Detect crisis situations** and provide immediate safety resources
- **Maintain conversation context** for personalized responses
- **Always emphasize** that it provides educational support, not medical advice

## 🔒 Security Features

- API keys stored securely on server-side
- CORS protection for cross-origin requests
- Rate limiting to prevent abuse
- Helmet.js security headers
- Input validation and sanitization
- Crisis detection for user safety

## 🛠️ Development

### Project Structure
```
/
├── server.js          # Node.js backend
├── index.html         # Frontend application
├── package.json       # Dependencies
├── .env              # Environment variables
└── README.md         # This file
```

### Available Scripts
- `npm start` - Production server
- `npm run dev` - Development with auto-restart
- `npm test` - Run tests (placeholder)

### Environment Variables
- `OPENAI_API_KEY` - Your OpenAI API key (required)
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode
- `FRONTEND_URL` - CORS origin (default: http://localhost:3001)

## 🚨 Crisis Detection

The system automatically detects crisis-related keywords and:
- Provides immediate safety resources
- Shows emergency contact numbers
- Offers grounding exercises
- Prioritizes user safety over conversation flow

## 📱 Mobile Support

The interface is fully responsive and includes:
- Touch-friendly message interface
- Optimized composer for mobile keyboards
- Proper viewport scaling
- Accessible navigation

## 🔧 Troubleshooting

### Backend server not starting
- Check if Node.js 16+ is installed: `node --version`
- Verify dependencies: `npm install`
- Check if port 3001 is available

### AI not responding
- Verify OpenAI API key in `.env` file
- Check server logs for API errors
- Ensure you have OpenAI API credits

### "Backend server unavailable"
- Make sure to start the server: `npm run dev`
- Check the Settings panel for server status
- Verify firewall isn't blocking port 3001

## 🎨 Customization

### Changing the AI Personality
Edit the `SYSTEM_PROMPT` in `server.js` to modify:
- Communication style
- Expertise areas
- Response guidelines
- Safety protocols

### UI Customization
Modify the CSS variables in `index.html`:
```css
:root {
    --bg-primary: #F5F0E6;      /* Background color */
    --accent-primary: #FF7A2F;   /* Brand color */
    --text-primary: #2C2C2C;     /* Text color */
    /* ... more variables */
}
```

## 📝 License

MIT License - feel free to use this for educational or research purposes.

## 🙏 Acknowledgments

- Inspired by Claude's conversational interface
- Built for supporting cancer patients and caregivers
- Focused on evidence-based fatigue management strategies

---

**Important**: This application provides educational support and is not a substitute for professional medical care. Users experiencing medical emergencies should contact emergency services immediately.