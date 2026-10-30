"""
TruthGuard – FastAPI Backend v3.0 (Gemini-powered)
====================================================
Pipeline:
  Retriever   → keyword scoring to find best passage per document
  Synthesizer → Gemini 1.5 Flash generates a natural answer (fallback: rule-based)
  Critic      → Jaccard similarity detects contradictions
  Resolver    → expert-system selects trusted source

Endpoints:
  POST /api/config          – save Gemini API key (stored in memory)
  GET  /api/config/status   – check if Gemini is configured
  POST /api/documents       – upload PDF + metadata
  GET  /api/documents       – list documents
  DELETE /api/documents/{id}– delete document
  POST /api/samples         – load built-in sample docs
  POST /api/ask             – run full pipeline
  GET  /api/audit           – query history
"""

import re, uuid
import fitz                          # PyMuPDF
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Gemini (optional – only loaded when API key is provided) ─────────────────
_gemini_model  = None   # set by /api/config
_gemini_key    = ""     # stored in memory

def _init_gemini(api_key: str):
    """Try to initialise Gemini. Returns (success, message)."""
    global _gemini_model, _gemini_key
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        _gemini_model = genai.GenerativeModel("gemini-1.5-flash")
        _gemini_key   = api_key
        # Quick test
        _gemini_model.generate_content("Say OK")
        return True, "Gemini 1.5 Flash connected successfully."
    except Exception as e:
        _gemini_model = None
        _gemini_key   = ""
        return False, str(e)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="TruthGuard API", version="3.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory stores ──────────────────────────────────────────────────────────
document_store: list[dict] = []
audit_store:    list[dict] = []

# ── Stopwords ─────────────────────────────────────────────────────────────────
STOPWORDS = {
    "a","an","the","is","are","was","were","be","been","being","have","has","had",
    "do","does","did","will","would","could","should","may","might","shall","can",
    "in","on","at","to","for","of","with","by","from","about","into","through",
    "between","each","every","all","both","few","more","most","other","some","such",
    "no","not","only","own","same","than","too","very","just","but","and","or","nor",
    "so","yet","what","which","who","whom","this","that","these","those","i","you",
    "he","she","it","we","they","me","him","her","us","them","my","your","his","its",
    "our","their","how","when","where","why","as","if","then","because","while",
}

# ── PDF helpers ───────────────────────────────────────────────────────────────
def extract_text_from_pdf(file_bytes: bytes) -> str:
    pdf  = fitz.open(stream=file_bytes, filetype="pdf")
    text = "\n".join(page.get_text() for page in pdf).strip()
    pdf.close()
    if not text:
        raise ValueError("No readable text found – PDF may be scanned or image-only.")
    return text


def make_pdf_bytes(lines: list[str]) -> bytes:
    doc  = fitz.open()
    page = doc.new_page()
    y = 72
    for line in lines:
        if line.startswith("# "):
            page.insert_text((72, y), line[2:], fontsize=16)
            y += 28
        elif line.startswith("## "):
            page.insert_text((72, y), line[3:], fontsize=12)
            y += 22
        elif line == "":
            y += 10
        else:
            page.insert_text((72, y), line, fontsize=10)
            y += 16
        if y > 760:
            break
    data = doc.tobytes()
    doc.close()
    return data

# ── NLP helpers ───────────────────────────────────────────────────────────────
def get_keywords(text: str) -> list[str]:
    words = re.findall(r"[a-zA-Z0-9]+", text.lower())
    return [w for w in words if w not in STOPWORDS and len(w) > 1]


def score_sentence(sentence: str, keywords: list[str]) -> int:
    low = sentence.lower()
    return sum(1 for kw in keywords if kw in low)


def jaccard_sim(a: str, b: str) -> float:
    ka, kb = set(get_keywords(a)), set(get_keywords(b))
    if not ka or not kb:
        return 1.0
    return len(ka & kb) / len(ka | kb)

# ── Stage 1: Retriever ────────────────────────────────────────────────────────
def retrieve(question: str) -> list[dict]:
    keywords = get_keywords(question)
    if not keywords:
        return []
    results = []
    for doc in document_store:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", doc["text"]) if s.strip()]
        if not sentences:
            continue
        scores   = [score_sentence(s, keywords) for s in sentences]
        best_idx = max(range(len(scores)), key=lambda i: scores[i])
        start    = max(0, best_idx - 1)
        end      = min(len(sentences), best_idx + 3)
        passage  = " ".join(sentences[start:end])
        results.append({
            "doc_id":           doc["id"],
            "filename":         doc["filename"],
            "title":            doc["title"],
            "version":          doc["version"],
            "publication_date": doc["publication_date"],
            "authority_tier":   doc["authority_tier"],
            "superseded_by":    doc["superseded_by"],
            "passage":          passage,
            "score":            scores[best_idx],
        })
    results.sort(key=lambda x: x["score"], reverse=True)
    return results

# ── Stage 2: Synthesizer (Gemini-powered with fallback) ───────────────────────
def synthesize(retrieved: list[dict], question: str) -> dict:
    found = [r for r in retrieved if r["score"] > 0]

    if not found:
        return {
            "answer":    "No relevant information found in the uploaded documents.",
            "citations": [],
            "ai_powered": False,
        }

    citations = [
        {
            "doc_id":   r["doc_id"],
            "filename": r["filename"],
            "title":    r["title"],
            "version":  r["version"],
            "passage":  r["passage"],
            "score":    r["score"],
        }
        for r in found
    ]

    # ── Try Gemini first ──
    if _gemini_model:
        try:
            evidence = "\n\n".join(
                f"[{r['title'] or r['filename']}"
                + (f" v{r['version']}" if r['version'] else "")
                + f" | {r['publication_date'] or 'unknown date'}"
                + f" | Authority Tier {r['authority_tier']}]:\n{r['passage']}"
                for r in found
            )

            prompt = f"""You are TruthGuard, a document verification assistant.
A user asked: "{question}"

Below are relevant passages retrieved from uploaded documents:

{evidence}

Instructions:
- Answer the question using ONLY the evidence provided above.
- Be clear, concise, and professional.
- Mention which document each piece of information comes from.
- If documents disagree, point out the disagreement clearly.
- Do NOT make up information not present in the evidence.
- Keep your answer under 200 words.

Answer:"""

            response = _gemini_model.generate_content(prompt)
            return {
                "answer":    response.text.strip(),
                "citations": citations,
                "ai_powered": True,
            }
        except Exception as e:
            # Fall through to rule-based if Gemini fails
            pass

    # ── Fallback: rule-based synthesis ──
    parts = []
    for r in found:
        label = (r["title"] or r["filename"]) + (f' v{r["version"]}' if r["version"] else "")
        parts.append(f'According to {label}: "{r["passage"].strip()}"')

    return {
        "answer":    "\n\n".join(parts),
        "citations": citations,
        "ai_powered": False,
    }

# ── Stage 3: Critic ───────────────────────────────────────────────────────────
def criticize(retrieved: list[dict]) -> dict:
    found    = [r for r in retrieved if r["score"] > 0]
    existing = {doc["filename"] for doc in document_store}

    outdated = [
        {"filename": r["filename"], "title": r["title"], "superseded_by": r["superseded_by"]}
        for r in found
        if r["superseded_by"] and r["superseded_by"] in existing
    ]

    contradictions = []
    for i in range(len(found)):
        for j in range(i + 1, len(found)):
            sim = jaccard_sim(found[i]["passage"], found[j]["passage"])
            if sim < 0.20:
                contradictions.append({
                    "doc_a": {k: found[i][k] for k in
                              ("filename","title","version","authority_tier","publication_date","passage")},
                    "doc_b": {k: found[j][k] for k in
                              ("filename","title","version","authority_tier","publication_date","passage")},
                    "similarity": round(sim, 3),
                    "type": "contradiction",
                })

    return {
        "contradictions": contradictions,
        "outdated":       outdated,
        "unsupported":    len(found) == 0,
    }

# ── Stage 4: Resolver ─────────────────────────────────────────────────────────
def resolve(retrieved: list[dict], critic: dict) -> dict:
    found = [r for r in retrieved if r["score"] > 0]

    if not found or critic["unsupported"]:
        return {
            "trusted_source": None, "trusted_title": None,
            "reason": "No relevant evidence was found in any document.",
            "status": "no_evidence", "all_positions": [],
        }

    if not critic["contradictions"]:
        best = found[0]
        return {
            "trusted_source": best["filename"],
            "trusted_title":  best["title"],
            "reason": f'All sources are consistent. Top source: "{best["title"] or best["filename"]}".',
            "status": "verified", "all_positions": [],
        }

    existing     = {doc["filename"] for doc in document_store}
    outdated_set = {r["filename"] for r in found
                    if r["superseded_by"] and r["superseded_by"] in existing}
    candidates   = [r for r in found if r["filename"] not in outdated_set] or found

    def sort_key(r):
        tier = r["authority_tier"] if r["authority_tier"] else 99
        try:
            ts = datetime.fromisoformat(r["publication_date"]).timestamp() if r["publication_date"] else 0
        except Exception:
            ts = 0
        return (tier, -ts)

    candidates.sort(key=sort_key)

    if len(candidates) == 1:
        c        = candidates[0]
        excluded = ", ".join(f'"{r["title"] or r["filename"]}"' for r in found if r["filename"] in outdated_set)
        return {
            "trusted_source": c["filename"], "trusted_title": c["title"],
            "reason": (
                f'Conflict resolved. "{c["title"] or c["filename"]}" is the active source.'
                + (f" Superseded documents excluded: {excluded}." if excluded else "")
            ),
            "status": "resolved", "all_positions": [],
        }

    best, second = candidates[0], candidates[1]
    bt = best["authority_tier"] or 99
    st = second["authority_tier"] or 99

    if bt < st:
        return {
            "trusted_source": best["filename"], "trusted_title": best["title"],
            "reason": (
                f'Resolved by authority. "{best["title"] or best["filename"]}" (tier {bt}) '
                f'outranks "{second["title"] or second["filename"]}" (tier {st}).'
            ),
            "status": "resolved", "all_positions": [],
        }

    try:
        bd = datetime.fromisoformat(best["publication_date"])   if best["publication_date"]   else None
        sd = datetime.fromisoformat(second["publication_date"]) if second["publication_date"] else None
    except Exception:
        bd = sd = None

    if bd and sd and bd > sd:
        return {
            "trusted_source": best["filename"], "trusted_title": best["title"],
            "reason": (
                f'Resolved by date. "{best["title"] or best["filename"]}" ({best["publication_date"]}) '
                f'is newer than "{second["title"] or second["filename"]}" ({second["publication_date"]}).'
            ),
            "status": "resolved", "all_positions": [],
        }

    all_positions = [
        {"filename": r["filename"], "title": r["title"], "version": r["version"], "passage": r["passage"]}
        for r in candidates
    ]
    sources_str = " | ".join(
        f'"{r["title"] or r["filename"]}": {r["passage"][:80]}…' for r in candidates[:3]
    )
    return {
        "trusted_source": None, "trusted_title": None,
        "reason": (
            "Cannot Resolve: Multiple equally-authoritative sources provide conflicting information. "
            f"Conflicting positions: {sources_str}"
        ),
        "status": "cannot_resolve", "all_positions": all_positions,
    }

# ── Metadata helper ───────────────────────────────────────────────────────────
def _meta(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "text"}

# ── Request models ────────────────────────────────────────────────────────────
class AskRequest(BaseModel):
    question: str

class ConfigRequest(BaseModel):
    api_key: str

# ═════════════════════════════════════════════════════════════════════════════
# Routes
# ═════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {
        "status": "TruthGuard API v3 running",
        "gemini": "connected" if _gemini_model else "not configured",
    }

# ── Config ────────────────────────────────────────────────────────────────────
@app.post("/api/config")
def set_config(body: ConfigRequest):
    """Save the Gemini API key and initialise the model."""
    if not body.api_key.strip():
        raise HTTPException(400, "API key cannot be empty.")
    ok, msg = _init_gemini(body.api_key.strip())
    if not ok:
        raise HTTPException(400, f"Could not connect to Gemini: {msg}")
    return {"message": msg, "model": "gemini-1.5-flash"}


@app.get("/api/config/status")
def get_config_status():
    return {
        "gemini_configured": _gemini_model is not None,
        "model": "gemini-1.5-flash" if _gemini_model else None,
    }

# ── Documents ─────────────────────────────────────────────────────────────────
@app.post("/api/documents")
async def upload_document(
    file:             UploadFile = File(...),
    title:            str = Form(""),
    version:          str = Form(""),
    publication_date: str = Form(""),
    authority_tier:   int = Form(3),
    superseded_by:    str = Form(""),
):
    filename = file.filename or "unknown.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files are supported.")
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(400, "File is empty.")
    try:
        text = extract_text_from_pdf(file_bytes)
    except ValueError as e:
        raise HTTPException(422, str(e))
    except Exception:
        raise HTTPException(422, "Could not read this PDF – it may be corrupt.")

    document_store[:] = [d for d in document_store if d["filename"] != filename]
    doc = {
        "id":               str(uuid.uuid4()),
        "filename":         filename,
        "title":            title.strip(),
        "version":          version.strip(),
        "publication_date": publication_date.strip(),
        "authority_tier":   authority_tier,
        "superseded_by":    superseded_by.strip() or None,
        "char_count":       len(text),
        "text":             text,
        "uploaded_at":      datetime.now().isoformat(),
    }
    document_store.append(doc)
    return {"message": "Document uploaded.", "document": _meta(doc)}


@app.get("/api/documents")
def list_documents():
    return {"documents": [_meta(d) for d in document_store]}


@app.delete("/api/documents/{doc_id}")
def delete_document(doc_id: str):
    before = len(document_store)
    document_store[:] = [d for d in document_store if d["id"] != doc_id]
    if len(document_store) == before:
        raise HTTPException(404, "Document not found.")
    return {"message": "Document deleted."}


@app.post("/api/samples")
def load_samples():
    samples = [
        {
            "filename": "medication_policy_v1.pdf",
            "title": "Medication Administration Policy",
            "version": "1.0",
            "publication_date": "2022-03-15",
            "authority_tier": 3,
            "superseded_by": "medication_policy_v2.pdf",
            "lines": [
                "# Medication Administration Policy",
                "## Version 1.0 | Effective: March 15, 2022",
                "## Recommended dosage: 250mg administered twice daily.",
                "## Treatment duration: 7 days minimum.",
                "Administer with food to reduce gastric discomfort.",
                "Store at room temperature, 15 to 25 degrees Celsius.",
                "Do not administer to patients with known renal impairment.",
                "Consult physician before prescribing to elderly patients.",
                "Note: This document was superseded by Version 2.0 published June 2024.",
            ],
        },
        {
            "filename": "medication_policy_v2.pdf",
            "title": "Medication Administration Policy",
            "version": "2.0",
            "publication_date": "2024-06-01",
            "authority_tier": 2,
            "superseded_by": None,
            "lines": [
                "# Medication Administration Policy",
                "## Version 2.0 | Effective: June 1, 2024",
                "## This document supersedes Version 1.0 (March 2022).",
                "## Recommended dosage: 500mg administered once daily.",
                "Treatment duration: 5 days.",
                "May be taken with or without food.",
                "Refrigerate at 2 to 8 degrees Celsius. Do not freeze.",
                "Safe for patients with mild renal impairment at standard dose.",
                "Approved by the Clinical Governance Committee. Authority Tier 2.",
            ],
        },
        {
            "filename": "pediatric_guidelines.pdf",
            "title": "Pediatric Medication Guidelines",
            "version": "1.5",
            "publication_date": "2023-09-10",
            "authority_tier": 2,
            "superseded_by": None,
            "lines": [
                "# Pediatric Medication Guidelines",
                "## Version 1.5 | September 10, 2023",
                "## For patients under 18 years: 125mg twice daily.",
                "Weight-adjusted dosing: 5mg per kilogram of body weight per day.",
                "Maximum pediatric dose: 250mg per day. Treatment duration: 7 days.",
                "Monitor liver function tests weekly during treatment.",
                "Approved by the Pediatric Clinical Committee. Authority Tier 2.",
            ],
        },
    ]

    added = []
    for s in samples:
        pdf_bytes = make_pdf_bytes(s["lines"])
        text = extract_text_from_pdf(pdf_bytes)
        document_store[:] = [d for d in document_store if d["filename"] != s["filename"]]
        doc = {
            "id":               str(uuid.uuid4()),
            "filename":         s["filename"],
            "title":            s["title"],
            "version":          s["version"],
            "publication_date": s["publication_date"],
            "authority_tier":   s["authority_tier"],
            "superseded_by":    s["superseded_by"],
            "char_count":       len(text),
            "text":             text,
            "uploaded_at":      datetime.now().isoformat(),
        }
        document_store.append(doc)
        added.append(_meta(doc))

    return {"message": f"{len(added)} sample documents loaded.", "documents": added}


# ── Ask ───────────────────────────────────────────────────────────────────────
@app.post("/api/ask")
def ask(body: AskRequest):
    question = body.question.strip()
    if not question:
        raise HTTPException(400, "Question cannot be empty.")
    if not document_store:
        raise HTTPException(400, "No documents uploaded yet.")

    retrieved       = retrieve(question)
    synthesized     = synthesize(retrieved, question)
    critic_result   = criticize(retrieved)
    resolver_result = resolve(retrieved, critic_result)

    result = {
        "id":                str(uuid.uuid4()),
        "question":          question,
        "answer":            synthesized["answer"],
        "ai_powered":        synthesized["ai_powered"],
        "citations":         synthesized["citations"],
        "contradictions":    critic_result["contradictions"],
        "outdated":          critic_result["outdated"],
        "unsupported":       critic_result["unsupported"],
        "trusted_source":    resolver_result["trusted_source"],
        "trusted_title":     resolver_result["trusted_title"],
        "resolution_reason": resolver_result["reason"],
        "status":            resolver_result["status"],
        "all_positions":     resolver_result.get("all_positions", []),
        "timestamp":         datetime.now().isoformat(),
    }

    audit_store.append({
        "id":                result["id"],
        "question":          question,
        "status":            resolver_result["status"],
        "conflicts_detected": len(critic_result["contradictions"]),
        "trusted_source":    resolver_result["trusted_source"],
        "trusted_title":     resolver_result["trusted_title"],
        "answer_preview":    synthesized["answer"][:200],
        "ai_powered":        synthesized["ai_powered"],
        "timestamp":         result["timestamp"],
    })

    return result


@app.get("/api/audit")
def get_audit():
    return {"history": list(reversed(audit_store))}
