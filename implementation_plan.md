# VoiceBot Project Structure

```
Sanakr_assignment/
├── backend/
│   ├── main.py              # FastAPI app, CORS, routes
│   ├── ai_services.py       # Whisper STT, LLM, TTS functions
│   ├── conversation.py      # Multi-turn memory manager
│   ├── logger.py            # JSON logging middleware
│   ├── requirements.txt
│   ├── .env.example
│   └── chat_logs.json
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── public/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.js
│   │   │   ├── page.js
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── VoiceBot.jsx
│   │   │   ├── ChatBubble.jsx
│   │   │   ├── MicButton.jsx
│   │   │   ├── LogsPanel.jsx
│   │   │   └── WaveformVisualizer.jsx
│   │   └── hooks/
│   │       └── useAudioRecorder.js
│   └── .env.local.example
└── README.md
```
