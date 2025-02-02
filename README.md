# Offline Chat Application

![Chat Interface](screenshots/chat-interface.png)

A private, offline-first chat application powered by local AI models through Ollama.

## Features
- Full conversation history
- Model parameter controls
- Local model management
- Markdown support
- System prompt engineering
- Secure offline storage

## Tech Stack
**Frontend:** HTML5, CSS3, Vanilla JavaScript  
**Backend:** FastAPI, Ollama Python Client  
**AI Engine:** Ollama  
**Powered By:** DeepSeek-R1

## Installation

### 1. Ollama Setup
```bash
curl -fsSL https://ollama.com/install.sh | sh

# Windows
# Download from https://ollama.com/download/OllamaSetup.exe
```

### 2. Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd frontend
# No installation needed - pure HTML/JS/CSS
```

## Running the Application

1. Start Ollama Service:
```bash
ollama serve
```

2. Start Backend API:
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 3000
```

3. Open Frontend:
```bash
open frontend/chat.html  # Or double-click in file explorer
```

## Project Structure
```
project-root/
├── frontend/
│   ├── chat.html        # Main interface
│   ├── app.js              # Client-side logic
│   └── styles.css          # Styling
└── backend/
    ├── main.py             # FastAPI server
    └── requirements.txt   # Python dependencies
```

## Key Code References

Frontend footer implementation:
```html:frontend/chat.html
startLine: 50
endLine: 62
```

Backend streaming logic:
```python:backend/main.py
startLine: 150
endLine: 189
```

## Acknowledgements
- Special thanks to MK for architectural guidance
- Ollama integration inspired by their official Python client
- UI design influenced by modern chat applications

## License
AGPL-3.0

---

**Powered By:** DeepSeek-R1 • Ollama  
**Data Storage:** Conversations never leave your device  
**Model Safety:** All AI interactions are 100% private & secure 
**Model Management:** Download new models from the web
**Model Training:** Use your own data to train your own models
