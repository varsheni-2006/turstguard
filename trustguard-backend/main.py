"""
TruthGuard – FastAPI Backend
============================
Endpoints:
  POST /upload    – upload PDFs, extract + store text
  GET  /documents – list stored documents
  POST /ask       – search stored docs for an answer, detect conflicts
"""

import re
import fitz                          # PyMuPDF
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(title="TruthGuard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory store ───────────────────────────────────────────────────────────
# Each item: { "filename": str, "char_count": int, "text": str }
document_store: list[dict] = []

# ── Stopwords (common words that carry no meaning for search) ─────────────────
STOPWORDS = {
    "a","an","the","is","are","was","were","be","been","being",
    "have","has","had","do","does","did","will","would","could",
    "should","may","might","shall","can","need","dare","ought",
    "in","on","at","to","for","of","with","by","from","about",
    "into","through","during","before","after","above","below",
    "between","each","every","all","both","few","more","most",
    "other","some","such","no","not","only","own","same","than",
    "too","very","just","but","and","or","nor","so","yet","what",
    "which","who","whom","this","that","these","those","i","you",
    "he","she","it","we","they","me","him","her","us","them","my",
    "your","his","its","our","their","how","when","where","why",
}

# ── PDF extraction ────────────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    pdf = fitz.open(stream=file_bytes, filetype="pdf")
    pages_text = [page.get_text() for page in pdf]
    pdf.close()
    full_text = "\n".join(pages_text).strip()
    if not full_text:
        raise ValueError("No readable text found – the PDF may be scanned or image-only.")
    return full_text

# ── Keyword search helpers ────────────────────────────────────────────────────

def get_keywords(text: str) -> list[str]:
    """Lower-case words from `text`, stopwords removed."""
    words = re.findall(r"[a-zA-Z0-9]+", text.lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 1]


def score_sentence(sentence: str, keywords: list[str]) -> int:
    """Count how many keywords appear in the sentence."""
    low = sentence.lower()
    return sum(1 for kw in keywords if kw in low)


def find_best_passage(text: str, keywords: list[str], context: int = 2) -> tuple[str, int]:
    """
    Split text into sentences, score each by keyword matches.
    Return the best-matching sentence (+ neighbours) and its score.
    `context` = how many sentences before/after to include.
    """
    # Split on sentence-ending punctuation
    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    if not sentences:
        return ("", 0)

    scores = [score_sentence(s, keywords) for s in sentences]
    best_idx = scores.index(max(scores))
    best_score = scores[best_idx]

    # Grab context window
    start = max(0, best_idx - context)
    end = min(len(sentences), best_idx + context + 1)
    passage = " ".join(sentences[start:end])

    return (passage, best_score)


def passages_conflict(passages: list[str]) -> bool:
    """
    Simple conflict heuristic:
    Two passages conflict if they share very few keywords with each other
    (Jaccard similarity < 0.15) — meaning they talk about very different things.
    Only applies when we have 2+ docs with real passages.
    """
    if len(passages) < 2:
        return False

    keyword_sets = [set(get_keywords(p)) for p in passages]

    # Compare every pair
    for i in range(len(keyword_sets)):
        for j in range(i + 1, len(keyword_sets)):
            a, b = keyword_sets[i], keyword_sets[j]
            if not a or not b:
                continue
            intersection = a & b
            union = a | b
            jaccard = len(intersection) / len(union) if union else 1.0
            if jaccard < 0.15:
                return True

    return False

# ── Request / Response models ─────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str

# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "TruthGuard API is running"}


@app.post("/upload")
async def upload_documents(files: list[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files were sent.")

    results = []

    for upload in files:
        filename = upload.filename or "unknown.pdf"

        if not filename.lower().endswith(".pdf"):
            results.append({"filename": filename, "char_count": 0,
                            "status": "error", "error": "Only PDF files are supported."})
            continue

        file_bytes = await upload.read()
        if len(file_bytes) == 0:
            results.append({"filename": filename, "char_count": 0,
                            "status": "error", "error": "The file is empty."})
            continue

        try:
            text = extract_text_from_pdf(file_bytes)
        except ValueError as ve:
            results.append({"filename": filename, "char_count": 0,
                            "status": "error", "error": str(ve)})
            continue
        except Exception:
            results.append({"filename": filename, "char_count": 0,
                            "status": "error",
                            "error": "Could not read this PDF. The file may be corrupt."})
            continue

        document_store[:] = [d for d in document_store if d["filename"] != filename]
        document_store.append({"filename": filename, "char_count": len(text), "text": text})
        results.append({"filename": filename, "char_count": len(text),
                        "status": "ok", "error": None})

    return JSONResponse(content={"documents": results})


@app.get("/documents")
def list_documents():
    return {"documents": [
        {"filename": d["filename"], "char_count": d["char_count"]}
        for d in document_store
    ]}


@app.post("/ask")
def ask_question(body: AskRequest):
    """
    Search stored documents for the best passage that answers `question`.
    Returns per-document answers and a conflict flag.

    Response shape:
    {
      "question": str,
      "answers": [
        { "filename": str, "passage": str, "score": int, "found": bool }
      ],
      "has_conflict": bool,
      "conflict_reason": str | null
    }
    """
    question = body.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    if not document_store:
        raise HTTPException(
            status_code=400,
            detail="No documents uploaded yet. Please upload PDFs first."
        )

    keywords = get_keywords(question)
    if not keywords:
        raise HTTPException(status_code=400, detail="Question too vague – please be more specific.")

    answers = []
    good_passages = []  # passages with score > 0, used for conflict check

    for doc in document_store:
        passage, score = find_best_passage(doc["text"], keywords)
        found = score > 0
        answers.append({
            "filename": doc["filename"],
            "passage": passage if found else "No relevant content found for this question.",
            "score": score,
            "found": found,
        })
        if found:
            good_passages.append(passage)

    # Conflict detection
    conflict = passages_conflict(good_passages)
    conflict_reason = (
        "The documents appear to contain different information about this topic. "
        "Review each passage carefully to identify the discrepancy."
        if conflict else None
    )

    return {
        "question": question,
        "answers": answers,
        "has_conflict": conflict,
        "conflict_reason": conflict_reason,
    }
