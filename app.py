"""SnoopAnatomy - FastAPI application server.

Serves the anatomical knowledge graph API and mounts the static frontend.
Run with: python app.py
Access at: http://localhost:8000
"""

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import json
import os

app = FastAPI(title="SnoopAnatomy", version="0.1.0")


@app.middleware("http")
async def no_cache_static(request, call_next):
    """Force the browser to revalidate files so code edits appear on refresh."""
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, must-revalidate"
    return response

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
_base_dir = os.path.dirname(os.path.abspath(__file__))
_data_path = os.path.join(_base_dir, "data", "anatomy_graph.json")

with open(_data_path, "r", encoding="utf-8") as _f:
    _anatomy_data = json.load(_f)

from engine.auditor import audit_notes
from engine.what_if import evaluate_what_if, get_all_audit_notes, delete_audit_note
from engine.assistant import respond_to_query

# ---------------------------------------------------------------------------
# API Routes (must be registered before the static file catch-all)
# ---------------------------------------------------------------------------

@app.post("/api/assistant")
async def assistant_chat(request: Request):
    """Conversational tutor endpoint: blends command execution and anatomical question answering."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    message = body.get("message", "")
    notes = body.get("notes", {})
    selected_id = body.get("selected_structure_id", "")
    result = respond_to_query(message, notes, selected_id)
    return JSONResponse(content=result)

@app.get("/api/anatomy")
async def get_anatomy():
    """Return all anatomical structures with coordinates and metadata."""
    return JSONResponse(content=_anatomy_data)


@app.post("/api/audit")
async def run_audit(request: Request):
    """Analyze notes against anatomy knowledge graph and detect coverage gaps."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    result = audit_notes(body)
    return JSONResponse(content=result)


@app.post("/api/what-if")
async def run_what_if(request: Request):
    """Validate student clinical answer and generate verified takeaway."""
    try:
        body = await request.json()
    except Exception:
        body = {}
    structure_id = body.get("structure_id", "")
    question = body.get("question", "")
    answer = body.get("answer", "")
    result = evaluate_what_if(structure_id, question, answer)
    return JSONResponse(content=result)


@app.get("/api/audit-notes")
async def list_audit_notes():
    """Return all saved audit notes from the audit_notes/ folder."""
    notes = get_all_audit_notes()
    return JSONResponse(content={"audit_notes": notes})


@app.delete("/api/audit-notes/{structure_id}")
async def remove_audit_note(structure_id: str):
    """Delete a saved audit note by structure ID."""
    deleted = delete_audit_note(structure_id)
    return JSONResponse(content={"deleted": deleted, "structure_id": structure_id})

# ---------------------------------------------------------------------------
# Static file serving (catch-all — must be last)
# ---------------------------------------------------------------------------
_static_dir = os.path.join(_base_dir, "static")
app.mount("/", StaticFiles(directory=_static_dir, html=True), name="static")

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    print("Starting SnoopAnatomy on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
