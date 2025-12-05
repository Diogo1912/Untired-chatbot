# Agentic Tools Framework

This document describes the agentic capabilities of Untire Coach and provides guidelines for adding new tools.

## Current Tools

### 1. Meditation Videos
**Purpose**: Provide guided meditation and relaxation videos
**Trigger**: User expresses stress, anxiety, overwhelm, or requests relaxation
**Format**: `[VIDEO:title:embed_url]`
**Implementation**: Embedded YouTube iframes

**Example Usage:**
```
AI: "I can sense you're feeling overwhelmed. Here's a gentle 10-minute meditation that might help..."
[VIDEO:10 Minute Guided Meditation:https://youtube.com/embed/xyz]
```

### 2. Breathing Exercises
**Purpose**: Provide immediate relief through guided breathing
**Trigger**: User needs quick stress relief or expresses anxiety
**Format**: `[BREATHING:title:duration:pattern:embed_code]`
**Implementation**: Interactive timer with pattern guidance

**Example Usage:**
```
AI: "Let's try a quick breathing exercise to help you feel more grounded..."
[BREATHING:Box Breathing:60:Inhale 4s, Hold 4s, Exhale 4s, Hold 4s:]
```

### 3. Fatigue Quiz
**Purpose**: Assess current fatigue level systematically
**Trigger**: User unsure about fatigue level or wants accurate assessment
**Implementation**: Multi-question validated questionnaire

### 4. Journaling Prompts (Framework Ready)
**Purpose**: Guide self-reflection and insight
**Trigger**: User seeks deeper understanding or processing emotions
**Format**: `[JOURNAL:prompt_text]`
**Status**: Backend ready, frontend implementation pending

**Planned Usage:**
```
AI: "Reflecting on your experience might help. Consider this prompt..."
[JOURNAL:What activities give you the most energy today?]
```

### 5. Activity Tracking (Framework Ready)
**Purpose**: Track daily activities and their energy impact
**Trigger**: User wants to identify patterns or track progress
**Format**: `[ACTIVITY:type:duration:energy_level]`
**Status**: Backend ready, frontend implementation pending

**Planned Usage:**
```
AI: "Let's track this activity to see how it affects your energy..."
[ACTIVITY:Walking:15:moderate]
```

### 6. Mood Tracking (Framework Ready)
**Purpose**: Monitor emotional well-being over time
**Trigger**: User shares emotional state or wants to track patterns
**Format**: `[MOOD:emotion:intensity:notes]`
**Status**: Backend ready, frontend implementation pending

**Planned Usage:**
```
AI: "I'd like to remember how you're feeling today..."
[MOOD:anxious:7:worried about treatment]
```

## Adding New Tools

### Step 1: Define Tool Specification

```javascript
// Tool specification template
{
  name: 'tool_name',
  purpose: 'What problem does this solve?',
  trigger: 'When should AI use this?',
  format: '[TAG:param1:param2:...]',
  userBenefit: 'How does this help users?',
  requirements: ['frontend', 'backend', 'database']
}
```

### Step 2: Backend Implementation

#### A. Add to AI Settings (database-mongo.js)

```javascript
// In getAISettings(), add to enabled_tools array
enabled_tools: [
  'videos', 
  'breathing', 
  'quiz', 
  'journaling', 
  'activity_tracking',
  'mood_tracking',
  'your_new_tool' // Add here
]
```

#### B. Add Tool Context to System Prompt (server-mongo.js)

```javascript
// In generateSystemPrompt() function
if (enabledTools.includes('your_new_tool')) {
  agenticGuidance += `
- You can use [YOUR_TOOL:param1:param2] to do X
- Use this when the user needs Y
- Format: [YOUR_TOOL:description:value]
`;
}
```

#### C. Parse Tool Output (server-mongo.js)

```javascript
// In POST /api/chat endpoint, after OpenAI response
const yourToolRegex = /\[YOUR_TOOL:([^:]+):([^\]]+)\]/g;
const toolResults = [];
while ((match = yourToolRegex.exec(response)) !== null) {
  toolResults.push({
    param1: match[1],
    param2: match[2]
  });
}
response = response.replace(/\[YOUR_TOOL:[^\]]+\]/g, '');

// Add to media content
const mediaContent = {
  videos: videos.length > 0 ? videos : null,
  breathing: breathingExercises.length > 0 ? breathingExercises : null,
  yourTool: toolResults.length > 0 ? toolResults : null
};
```

### Step 3: Frontend Implementation

#### A. Add Tool Widget Styles (index.html CSS)

```css
.your-tool-widget {
    margin-top: 1rem;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid #E7DED3;
    background: #FAFAFA;
}

.your-tool-title {
    padding: 0.75rem 1rem;
    background: #FFE8D9;
    color: #2C2C2C;
    font-weight: 500;
}

.your-tool-content {
    padding: 1rem;
}
```

#### B. Render Tool in Messages (index.html JavaScript)

```javascript
// In addMessage() function, after breathing exercises
if (media.yourTool && media.yourTool.length > 0) {
  media.yourTool.forEach(tool => {
    const toolId = Date.now() + Math.random();
    const toolContainer = document.createElement('div');
    toolContainer.className = 'your-tool-widget';
    toolContainer.innerHTML = `
      <div class="your-tool-title">${tool.title}</div>
      <div class="your-tool-content">
        ${tool.content}
      </div>
    `;
    contentDiv.appendChild(toolContainer);
  });
}
```

### Step 4: Admin Configuration

Add tool to admin console (admin.html):

```html
<div class="tool-card">
    <input type="checkbox" id="tool-yourname" value="your_tool_name" checked>
    <label for="tool-yourname">Your Tool Name</label>
</div>
```

### Step 5: Testing Checklist

- [ ] Tool appears in admin console
- [ ] Admin can enable/disable tool
- [ ] AI includes tool in appropriate contexts
- [ ] Tool tag is correctly parsed
- [ ] Frontend renders tool widget
- [ ] Tool provides value to users
- [ ] Tool doesn't break existing functionality

## Tool Design Best Practices

### 1. Context-Aware Triggering
Tools should be suggested when contextually appropriate:
```javascript
// Good: Specific trigger
if (userMessage.includes('stressed') || userMessage.includes('anxious')) {
  suggestBreathingExercise();
}

// Bad: Random or constant suggestions
if (Math.random() > 0.5) {
  suggestBreathingExercise();
}
```

### 2. User Control
Users should be able to:
- Accept or decline tool suggestions
- Disable specific tools via settings
- Control when tools appear

### 3. Non-Intrusive
- Tools should enhance, not interrupt conversation
- Keep tool widgets visually consistent
- Don't overwhelm with too many tools at once

### 4. Measurable Impact
Track tool effectiveness:
```javascript
{
  tool: 'breathing_exercise',
  used: true,
  completed: true,
  userFeedback: 'helpful',
  fatigueChange: -1.5 // Before: 7, After: 5.5
}
```

### 5. Accessibility
- Ensure tools work with screen readers
- Provide keyboard navigation
- Support mobile devices
- Include clear instructions

## Advanced Tool Ideas

### 1. Symptom Logger
**Purpose**: Track symptoms and patterns
**Format**: `[SYMPTOM:name:severity:duration:triggers]`
**Benefits**: 
- Identify patterns
- Share with doctors
- Predict fatigue episodes

### 2. Medication Reminder
**Purpose**: Gentle reminders for medication adherence
**Format**: `[REMINDER:medication:time:frequency]`
**Considerations**: 
- Privacy concerns
- Medical advice boundaries
- Liability issues

### 3. Energy Budget Calculator
**Purpose**: Help users plan activities within energy limits
**Format**: `[BUDGET:available_energy:planned_activities]`
**Benefits**:
- Prevent overexertion
- Realistic planning
- Activity prioritization

### 4. Sleep Quality Tracker
**Purpose**: Monitor sleep patterns
**Format**: `[SLEEP:duration:quality:interruptions]`
**Benefits**:
- Correlate sleep with fatigue
- Identify sleep issues
- Track improvements

### 5. Social Support Connector
**Purpose**: Connect with support groups or resources
**Format**: `[SUPPORT:type:location:online]`
**Benefits**:
- Reduce isolation
- Share experiences
- Find local resources

### 6. Nutrition Insights
**Purpose**: Energy-boosting food suggestions
**Format**: `[NUTRITION:energy_level:preferences:restrictions]`
**Benefits**:
- Dietary guidance
- Energy management
- Personalized suggestions

### 7. Movement Reminders
**Purpose**: Gentle movement suggestions based on energy
**Format**: `[MOVEMENT:type:intensity:duration]`
**Benefits**:
- Prevent deconditioning
- Adapted to energy levels
- Progressive improvement

### 8. Gratitude Journaling
**Purpose**: Positive psychology intervention
**Format**: `[GRATITUDE:prompt]`
**Benefits**:
- Improve mood
- Focus on positives
- Build resilience

### 9. Goal Setting Assistant
**Purpose**: Set and track realistic goals
**Format**: `[GOAL:description:deadline:milestones]`
**Benefits**:
- Sense of accomplishment
- Structured progress
- Motivation

### 10. Visualization Exercises
**Purpose**: Guided imagery for relaxation and healing
**Format**: `[VISUALIZATION:theme:duration:audio_url]`
**Benefits**:
- Deep relaxation
- Pain management
- Mental imagery for healing

## Tool Integration Guidelines

### When to Add a New Tool

✅ **Add when:**
- Clear user need identified
- Evidence-based benefit
- Fills gap in current tools
- Enhances existing features
- Requested by users or clinicians

❌ **Don't add when:**
- Duplicates existing functionality
- No clear benefit
- Too complex for users
- Crosses medical advice boundary
- Privacy/security concerns

### Tool Lifecycle

1. **Ideation**: Identify need
2. **Research**: Evidence and best practices
3. **Design**: User interface and experience
4. **Implement**: Backend and frontend
5. **Test**: With real users
6. **Monitor**: Usage and effectiveness
7. **Iterate**: Based on feedback
8. **Maintain**: Keep updated and functional

### Tool Metrics

Track these metrics for each tool:
```javascript
{
  toolName: 'breathing_exercise',
  timesOffered: 150,
  timesAccepted: 95,
  timesCompleted: 87,
  averageRating: 4.5,
  reportedHelpful: 82,
  commonTriggers: ['stress', 'anxiety', 'panic'],
  averageUsageTime: 45, // seconds
  repeatUsage: 65 // percentage
}
```

## Future Enhancements

### Multi-Modal Tools
- Voice-activated tools
- Video demonstrations
- Interactive games
- VR/AR experiences

### Personalized Tool Learning
- AI learns which tools work best for each user
- Adapts suggestions based on past usage
- Predicts when tools will be helpful

### Collaborative Tools
- Share progress with caregivers
- Healthcare provider integration
- Peer support features

### Advanced Analytics
- Pattern recognition in tool usage
- Predictive modeling for fatigue
- Personalized intervention timing

## Resources

### Evidence-Based Practices
- [Cancer Fatigue Management Guidelines](https://www.nccn.org/professionals/physician_gls/pdf/fatigue.pdf)
- [Behavioral Interventions for Cancer](https://www.cancer.gov/about-cancer/coping)
- [Digital Health Interventions](https://www.ncbi.nlm.nih.gov/pmc/)

### Design Inspiration
- Headspace (meditation)
- Calm (breathing, sleep)
- Daylio (mood tracking)
- MyFitnessPal (activity tracking)

### Technical References
- OpenAI Function Calling
- Progressive Web Apps (PWA)
- Web Accessibility Guidelines (WCAG)

---

**Remember**: Tools should empower users, not replace human support or medical care. Always maintain appropriate boundaries and encourage professional consultation when needed.

