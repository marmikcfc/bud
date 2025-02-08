# Buddy - Your Personal LLM Operating System

Buddy is an advanced AI assistant that aims to be your personal companion for various tasks, from simple computer operations to complex data analysis and task automation.

## 🌟 Features (In Development)

### Core Features
- 🎤 **Speech-to-Speech Interaction**
  - Wake word detection (e.g., "Hey Buddy", "Hi Buddy")
  - Real-time speech transcription using Moonshine ASR
  - Natural language understanding and intent identification

### Task Automation
- 🖥️ **Computer Control**
  - Screen content editing
  - Application control via accessibility features
  - System operations and file management

### Integration & Connectivity
- 📊 **Workspace Integration**
  - Google Workspace connectivity
  - ClickUp integration
  - Notion/Obsidian integration
  - Email management
  - Calendar management

### Intelligence & Memory
- 🧠 **Smart Context Understanding**
  - Screen context awareness
  - Personalized memory building
  - Contextual response generation

### Productivity Features
- 📝 **Meeting Assistant**
  - Automated note-taking
  - Meeting summarization
  - Notion/Obsidian note sync

### Agent System
- 🤖 **Extensible Agent Framework**
  - Custom agent creation
  - Background task execution
  - Dev-container support for open-source agents

### Models
- ☁️ **Hybrid Model Approach**
  - Cloud models for complex tasks
  - Local models for:
    - Task identification
    - Agent routing
    - Basic system control
    - Summarization
    - Dictation

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Electron

### Installation

1. Clone the repository:
```bash
git clone https://github.com/marmikcfc/buddy.git
cd buddy
```

2. Set up Python environment:
```bash
python -m venv env
source env/bin/activate  # On Windows: .\env\Scripts\activate
pip install -r requirements.txt
```

3. Install Node.js dependencies:
```bash
cd bud-electron
npm install
```

### Running the Application

1. Start the backend server:
```bash
cd bud-backend
python main.py
```

2. In a new terminal, start the Electron app:
```bash
cd bud-electron
npm start
```

The application will start in the system tray. You can:
- Click the tray icon to open the chat window
- Use the keyboard shortcut `Cmd+Shift+B` (Mac) or `Ctrl+Shift+B` (Windows/Linux) to open the chat window
- Say "Hey Buddy" (or other wake words) to activate the assistant

## 🏗️ Project Structure

```
buddy/
├── bud-backend/          # Python backend server
│   ├── main.py          # WebSocket server & wake word detection
│   └── models/          # ML models directory
├── bud-electron/        # Electron frontend
│   ├── src/            # Source files
│   │   ├── index.js    # Main process
│   │   └── audioSender.js # Audio streaming
│   └── package.json    # Dependencies
└── requirements.txt    # Python dependencies
```

## 🛠️ Development Status

Currently implementing:
- [x] Wake word detection system
- [x] Audio streaming
- [x] WebSocket communication
- [ ] Speech-to-text integration
- [ ] LLM integration
- [ ] Agent system
- [ ] Workspace integrations
- [ ] Browser use integration
- [ ] Ability to name your buddy

## 📝 License

[MIT License](LICENSE)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 