"""NeuroSoma - FastAPI application server.

Serves the anatomical knowledge graph API and mounts the static frontend.
Run with: python app.py
Access at: http://localhost:8000
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import json
import os

app = FastAPI(title="NeuroSoma", version="0.1.0")

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
_base_dir = os.path.dirname(os.path.abspath(__file__))
_data_path = os.path.join(_base_dir, "data", "anatomy_graph.json")

with open(_data_path, "r", encoding="utf-8") as _f:
    _anatomy_data = json.load(_f)

# ---------------------------------------------------------------------------
# API Routes (must be registered before the static file catch-all)
# ---------------------------------------------------------------------------

@app.get("/api/anatomy")
async def get_anatomy():
    """Return all anatomical structures with coordinates and metadata."""
    return JSONResponse(content=_anatomy_data)

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
    print("Starting NeuroSoma on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
