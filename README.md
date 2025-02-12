# Buddy - Your Personal AI Assistant

Buddy is an advanced AI assistant that aims to be your personal companion for various tasks, from simple computer operations to complex data analysis and task automation.

## 🌟 Features (In Development)

[Previous features sections remain unchanged...]

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- Electron

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/buddy.git
cd bud-electron
```

2. Set up Python environment and install dependencies:
```bash
python -m venv env
source env/bin/activate  # On Windows: .\env\Scripts\activate
pip install -r server/requirements.txt
```

3. Install Node.js dependencies:
```bash
pnpm install
```

### Running the Application

1. Start the application (this will start both the backend server and Electron app):
```bash
pnpm start
```

The application will start in the system tray. You can:
- Click the tray icon to open the chat window
- Use the keyboard shortcut `Cmd+Shift+B` (Mac) or `Ctrl+Shift+B` (Windows/Linux) to open the chat window
- Say "Hey Buddy" (or other wake words) to activate the assistant

## 🏗️ Project Structure

```
bud-electron/
├── desktop/           # Electron frontend
│   ├── index.js      # Main process
│   ├── index.html    # Main window
│   └── audioSender.js # Audio streaming
├── server/           # Python backend
│   ├── main.py      # WebSocket server & wake word detection
│   ├── models/      # ML models directory
│   └── requirements.txt # Python dependencies
├── package.json     # Node.js dependencies
└── README.md       # This file
```

[Rest of the sections remain unchanged...] 