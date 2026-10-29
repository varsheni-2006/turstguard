"""
TruthGuard – FastAPI Backend v2.0
===================================
Endpoints:
  POST   /api/documents            – upload one PDF with metadata
  GET    /api/documents            – list stored documents
  DELETE /api/documents/{doc_id}   – delete a document
  POST   /api/samples              – load 3 built-in sample documents
  POST   /api/ask                  – Retriever → Synthesizer → Critic → Resolver
  GET    /api/audit                – return audit history
"""

import re
import uuid
import fitz                                          # PyMuPDF
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="TruthGuard API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory stores ──────────────────────────────────────────────────────────
document_store: list[dict] = []   # includes full "text"
audit_store:    list[dict] = []   # query history

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
    pdf = fitz.open(stream=file_bytes, filetype="pdf")
    text = "\n".join(page.get_text() for page in pdf).strip()
    pdf.close()
    if not text:
        raise ValueError("No readable text found – PDF may be scanned or image-only.")
    return text


def make_pdf_bytes(lines: list[str]) -> bytes:
    """Create a simple PDF from a list of text lines and return raw bytes."""
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

# ── Pipeline: Retriever ───────────────────────────────────────────────────────
def retrieve(question: str) -> list[dict]:
    """Find the best matching passage in each document."""
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

        start   = max(0, best_idx - 1)
        end     = min(len(sentences), best_idx + 3)
        passage = " ".join(sentences[start:end])

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

# ── Pipeline: Synthesizer ─────────────────────────────────────────────────────
def synthesize(retrieved: list[dict]) -> dict:
    """Combine retrieved passages into a readable answer with citations."""
    found = [r for r in retrieved if r["score"] > 0]
    if not found:
        return {
            "answer":    "No relevant information found in the uploaded documents.",
            "citations": [],
        }

    parts, citations = [], []
    for r in found:
        label = (r["title"] or r["filename"]) + (f' v{r["version"]}' if r["version"] else "")
        parts.append(f'According to {label}: "{r["passage"].strip()}"')
        citations.append({
            "doc_id":   r["doc_id"],
            "filename": r["filename"],
            "title":    r["title"],
            "version":  r["version"],
            "passage":  r["passage"],
            "score":    r["score"],
        })

    return {"answer": "\n\n".join(parts), "citations": citations}

# ── Pipeline: Critic ──────────────────────────────────────────────────────────
def criticize(retrieved: list[dict]) -> dict:
    """Detect contradictions, outdated documents, and unsupported claims."""
    found    = [r for r in retrieved if r["score"] > 0]
    existing = {doc["filename"] for doc in document_store}

    # Outdated: doc is superseded by another doc that exists in the store
    outdated = [
        {"filename": r["filename"], "title": r["title"], "superseded_by": r["superseded_by"]}
        for r in found
        if r["superseded_by"] and r["superseded_by"] in existing
    ]

    # Contradictions: pairs with low passage similarity
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

# ── Pipeline: Resolver ────────────────────────────────────────────────────────
def resolve(retrieved: list[dict], critic: dict) -> dict:
    """Select the most trusted source or report 'Cannot Resolve'."""
    found = [r for r in retrieved if r["score"] > 0]

    if not found or critic["unsupported"]:
        return {
            "trusted_source":    None,
            "trusted_title":     None,
            "reason":            "No relevant evidence was found in any document.",
            "status":            "no_evidence",
            "all_positions":     [],
        }

    if not critic["contradictions"]:
        best = found[0]
        return {
            "trusted_source": best["filename"],
            "trusted_title":  best["title"],
            "reason":         f'All sources are consistent. Top source: "{best["title"] or best["filename"]}".',
            "status":         "verified",
            "all_positions":  [],
        }

    # Contradictions exist — try to resolve
    existing     = {doc["filename"] for doc in document_store}
    outdated_set = {r["filename"] for r in found
                    if r["superseded_by"] and r["superseded_by"] in existing}

    candidates = [r for r in found if r["filename"] not in outdated_set] or found

    def sort_key(r):
        tier = r["authority_tier"] if r["authority_tier"] else 99
        try:
            ts = datetime.fromisoformat(r["publication_date"]).timestamp() if r["publication_date"] else 0
        except Exception:
            ts = 0
        return (tier, -ts)

    candidates.sort(key=sort_key)

    # Only one non-superseded candidate
    if len(candidates) == 1:
        c = candidates[0]
        excluded = ", ".join(f'"{r["title"] or r["filename"]}"' for r in found if r["filename"] in outdated_set)
        return {
            "trusted_source": c["filename"],
            "trusted_title":  c["title"],
            "reason": (
                f'Conflict resolved. "{c["title"] or c["filename"]}" is the active source.'
                + (f' Superseded documents excluded: {excluded}.' if excluded else "")
            ),
            "status": "resolved",
            "all_positions": [],
        }

    best, second = candidates[0], candidates[1]
    bt = best["authority_tier"] or 99
    st = second["authority_tier"] or 99

    # Resolved by authority
    if bt < st:
        return {
            "trusted_source": best["filename"],
            "trusted_title":  best["title"],
            "reason": (
                f'Resolved by authority. "{best["title"] or best["filename"]}" (tier {bt}) '
                f'outranks "{second["title"] or second["filename"]}" (tier {st}).'
            ),
            "status": "resolved",
            "all_positions": [],
        }

    # Same authority — resolve by date
    try:
        bd = datetime.fromisoformat(best["publication_date"])   if best["publication_date"]   else None
        sd = datetime.fromisoformat(second["publication_date"]) if second["publication_date"] else None
    except Exception:
        bd = sd = None

    if bd and sd and bd > sd:
        return {
            "trusted_source": best["filename"],
            "trusted_title":  best["title"],
            "reason": (
                f'Resolved by date. "{best["title"] or best["filename"]}" ({best["publication_date"]}) '
                f'is newer than "{second["title"] or second["filename"]}" ({second["publication_date"]}).'
            ),
            "status": "resolved",
            "all_positions": [],
        }

    # Cannot resolve
    all_positions = [
        {"filename": r["filename"], "title": r["title"], "version": r["version"], "passage": r["passage"]}
        for r in candidates
    ]
    sources_str = " | ".join(
        f'"{r["title"] or r["filename"]}": {r["passage"][:80]}…'
        for r in candidates[:3]
    )
    return {
        "trusted_source": None,
        "trusted_title":  None,
        "reason": (
            "Cannot Resolve: Multiple equally-authoritative sources provide conflicting information. "
            f"Conflicting positions: {sources_str}"
        ),
        "status":        "cannot_resolve",
        "all_positions": all_positions,
    }

# ── Metadata helper ───────────────────────────────────────────────────────────
def _meta(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "text"}

# ── Request model ─────────────────────────────────────────────────────────────
class AskRequest(BaseModel):
    question: str

# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "TruthGuard API v2 running"}


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

    # Replace if same filename already exists
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
    """Generate 3 built-in sample PDFs with intentional conflicts for demonstration."""
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
                "",
                "## 1. Dosage Guidelines",
                "Recommended dosage: 250mg administered twice daily.",
                "Treatment duration: 7 days minimum.",
                "Administer with food to reduce gastric discomfort.",
                "",
                "## 2. Storage Requirements",
                "Store at room temperature, 15 to 25 degrees Celsius.",
                "Keep away from direct sunlight and moisture.",
                "",
                "## 3. Contraindications",
                "Do not administer to patients with known renal impairment.",
                "Consult physician before prescribing to elderly patients.",
                "",
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
                "",
                "## 1. Revised Dosage Guidelines",
                "Recommended dosage: 500mg administered once daily.",
                "Treatment duration: 5 days.",
                "May be taken with or without food.",
                "Clinical trials confirm improved efficacy with once-daily regimen.",
                "",
                "## 2. Storage Requirements",
                "Refrigerate at 2 to 8 degrees Celsius. Do not freeze.",
                "",
                "## 3. Updated Contraindications",
                "Safe for patients with mild renal impairment at standard dose.",
                "Reduce dose to 250mg for patients with moderate renal impairment.",
                "",
                "## 4. Governance",
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
                "",
                "## 1. Pediatric Dosage",
                "For patients under 18 years: 125mg twice daily.",
                "Weight-adjusted dosing: 5mg per kilogram of body weight per day.",
                "Maximum pediatric dose: 250mg per day.",
                "Treatment duration: 7 days.",
                "",
                "## 2. Adult Patients",
                "Adult patients must refer to the current Medication Administration Policy.",
                "Do not apply pediatric dosing guidelines to adult patients.",
                "",
                "## 3. Monitoring",
                "Monitor liver function tests weekly during treatment.",
                "Discontinue if enzymes exceed 3x the upper limit of normal.",
                "",
                "## 4. Governance",
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


@app.post("/api/ask")
def ask(body: AskRequest):
    question = body.question.strip()
    if not question:
        raise HTTPException(400, "Question cannot be empty.")
    if not document_store:
        raise HTTPException(400, "No documents uploaded yet. Please upload PDFs or load samples first.")

    # Run the four-stage pipeline
    retrieved        = retrieve(question)
    synthesized      = synthesize(retrieved)
    critic_result    = criticize(retrieved)
    resolver_result  = resolve(retrieved, critic_result)

    result = {
        "id":                str(uuid.uuid4()),
        "question":          question,
        "answer":            synthesized["answer"],
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

    # Save to audit
    audit_store.append({
        "id":                result["id"],
        "question":          question,
        "status":            resolver_result["status"],
        "conflicts_detected": len(critic_result["contradictions"]),
        "trusted_source":    resolver_result["trusted_source"],
        "trusted_title":     resolver_result["trusted_title"],
        "answer_preview":    synthesized["answer"][:200],
        "timestamp":         result["timestamp"],
    })

    return result


@app.get("/api/audit")
def get_audit():
    return {"history": list(reversed(audit_store))}
