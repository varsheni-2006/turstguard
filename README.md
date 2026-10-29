# TruthGuard – Document Verification App

TruthGuard is a document verification application that detects conflicting information across PDF documents and helps users identify the most trustworthy answer.

## Project Structure

```
jatayu/
├── trustguard-frontend/    ← React + Vite frontend
└── trustguard-backend/     ← Python FastAPI backend
```

## How to Run

### Backend (Terminal 1)
```bash
cd trustguard-backend
python -m venv venv

# Windows
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (Terminal 2)
```bash
cd trustguard-frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

## Features
- Upload multiple PDF documents
- Extract text using PyMuPDF
- Ask questions across all documents
- Keyword-based passage retrieval
- Conflict detection between documents

## Tech Stack
- **Frontend:** React + Vite, plain CSS
- **Backend:** Python FastAPI, PyMuPDF
- **Storage:** In-memory (no database)
