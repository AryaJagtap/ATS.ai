import os
import json
import tempfile
import asyncio
from typing import Optional, List
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
import pandas as pd

from config import OPENAI_API_KEY, GEMINI_API_KEY
from utils.downloader import download_resume
from utils.extractor import extract_text
from utils.scorer import score_resume
from utils.export import generate_excel_bytes

# ─── App Setup ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ATS.ai",
    description="AI-Powered Candidate Scoring Engine",
    version="2.0.0",
)

# ─── Concurrency Config ──────────────────────────────────────────────────────
# Process up to 15 resumes simultaneously for maximum throughput
BATCH_SIZE = 15
executor = ThreadPoolExecutor(max_workers=BATCH_SIZE)

# ─── CORS ─────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "2.0.0",
        "openai_configured": bool(OPENAI_API_KEY),
        "gemini_configured": bool(GEMINI_API_KEY),
    }


# ─── Helper: Resolve multiple JD texts ───────────────────────────────────────
async def _resolve_jd_texts(
    jd_text: Optional[str],
    jd_files: List[UploadFile],
) -> List[str]:
    """
    Build a list of JD text strings from user input.
    Sources: pasted text (1 entry) + any uploaded JD files.
    """
    jd_texts = []

    # Pasted text → one JD
    if jd_text and jd_text.strip():
        jd_texts.append(jd_text.strip())

    # Uploaded JD files → one JD each
    for jf in jd_files:
        if not jf.filename:
            continue
        ext = os.path.splitext(jf.filename)[-1].lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await jf.read()
            tmp.write(content)
            tmp_path = tmp.name
        text = extract_text(tmp_path)
        os.unlink(tmp_path)
        if text and text.strip():
            jd_texts.append(text.strip())

    return jd_texts


# ─── Helper: Score a single resume against all JDs (picks best) ──────────────
def _score_against_all_jds(
    resume_text: str,
    jd_texts: List[str],
    oai_key: str,
    gem_key: str,
) -> dict:
    """
    Score resume_text against every JD in jd_texts.
    Returns the score_data for the BEST matching JD,
    plus a 'Matched JD' field showing which role it matched.
    If only one JD, behaves exactly like before.
    """
    if len(jd_texts) == 1:
        score_data = score_resume(resume_text, jd_texts[0], oai_key, gem_key)
        score_data["Matched JD"] = score_data.get("Target Job Role", "Single JD")
        return score_data

    # Multiple JDs → score against each, pick best
    best_score = -1
    best_data = None

    for jd in jd_texts:
        score_data = score_resume(resume_text, jd, oai_key, gem_key)
        ats = score_data.get("ATS Score", 0) or 0

        if ats > best_score:
            best_score = ats
            best_data = score_data

    if best_data is None:
        best_data = score_resume(resume_text, jd_texts[0], oai_key, gem_key)

    best_data["Matched JD"] = best_data.get("Target Job Role", "N/A")
    return best_data


# ─── Single Candidate Processor (runs in thread) ─────────────────────────────
def _process_one_candidate(
    name: str, url: str, jd_texts: List[str], oai_key: str, gem_key: str,
) -> dict:
    """Download, extract, and score ONE resume against all JDs."""
    try:
        file_path = download_resume(url)
        if not file_path:
            raise Exception("Failed to download resume file.")

        resume_text = extract_text(file_path)
        if not resume_text:
            raise Exception("No text could be extracted (possibly a scanned image).")

        score_data = _score_against_all_jds(resume_text, jd_texts, oai_key, gem_key)

        return {"Candidate Name": name, "Resume Link": url, **score_data, "_ok": True}

    except Exception as e:
        return {
            "Candidate Name": name,
            "Resume Link": url,
            "ATS Score": 0,
            "Status": "Failed",
            "Phone Number": "Error",
            "Email": "Error",
            "Photo Link": "Error",
            "Resume Summary": f"Failed: {str(e)}",
            "Missing Requirements": "Error",
            "Job Description Summary": "Error",
            "Target Job Role": "Error",
            "Best Fit Role": "Error",
            "Matched JD": "Error",
            "Recommendation": "No",
            "_ok": False,
        }


# ─── Analyze Endpoint (CSV/XLSX + SSE Streaming + Concurrent) ────────────────
@app.post("/api/analyze")
async def analyze_candidates(
    candidate_file: UploadFile = File(...),
    jd_text: Optional[str] = Form(None),
    jd_files: List[UploadFile] = File(default=[]),
    openai_key: Optional[str] = Form(None),
    gemini_key: Optional[str] = Form(None),
):
    """
    Process candidate resumes (from CSV/XLSX) against one or more job descriptions.
    Uses concurrent batch processing for speed.
    Returns Server-Sent Events for real-time progress.
    """
    final_openai_key = openai_key or OPENAI_API_KEY
    final_gemini_key = gemini_key or GEMINI_API_KEY

    # ─── Resolve Job Descriptions ─────────────────────────────────────────────
    jd_texts = await _resolve_jd_texts(jd_text, jd_files)

    if not jd_texts:
        raise HTTPException(
            status_code=400,
            detail="Job description is required. Paste text or upload file(s).",
        )

    # ─── Read Candidate File ──────────────────────────────────────────────────
    try:
        file_ext = os.path.splitext(candidate_file.filename)[-1].lower()
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp:
            content = await candidate_file.read()
            tmp.write(content)
            tmp_path = tmp.name

        if file_ext == ".xlsx":
            df = pd.read_excel(tmp_path)
        else:
            df = pd.read_csv(tmp_path)
        os.unlink(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read candidate file: {str(e)}")

    # ─── Auto-detect columns ─────────────────────────────────────────────────
    url_col = next(
        (c for c in df.columns if "url" in c.lower() or "resume" in c.lower() or "link" in c.lower()),
        None,
    )
    name_col = next((c for c in df.columns if "name" in c.lower()), None)
    photo_col = next(
        (c for c in df.columns if "photo" in c.lower() or "image" in c.lower() or "picture" in c.lower()),
        None,
    )

    if not url_col:
        raise HTTPException(
            status_code=400,
            detail=f"Could not find a URL/Resume/Link column. Available columns: {list(df.columns)}",
        )

    df = df.dropna(subset=[url_col])
    total = len(df)

    candidates = []
    for idx, row in df.iterrows():
        name = str(row[name_col]) if name_col else f"Candidate {idx + 1}"
        url = str(row[url_col])
        photo = str(row[photo_col]).strip() if photo_col and pd.notna(row.get(photo_col)) else ""
        candidates.append((name, url, photo))

    # ─── SSE Generator with Batch Concurrency ─────────────────────────────────
    async def event_stream():
        loop = asyncio.get_event_loop()
        results = []
        completed = 0

        for batch_start in range(0, total, BATCH_SIZE):
            batch = candidates[batch_start : batch_start + BATCH_SIZE]

            for name, _, _ in batch:
                completed += 1
                progress_data = {
                    "type": "progress",
                    "current": completed,
                    "total": total,
                    "candidate": name,
                    "status": "processing",
                }
                yield f"data: {json.dumps(progress_data)}\n\n"

            futures = [
                loop.run_in_executor(
                    executor,
                    _process_one_candidate,
                    name, url, jd_texts, final_openai_key, final_gemini_key,
                )
                for name, url, _ in batch
            ]

            batch_results = await asyncio.gather(*futures)

            for i, result in enumerate(batch_results):
                ok = result.pop("_ok", False)

                # Inject photo URL from spreadsheet if available
                photo_from_sheet = batch[i][2] if len(batch[i]) > 2 else ""
                if photo_from_sheet and photo_from_sheet not in ("nan", "None", ""):
                    result["Photo Link"] = photo_from_sheet

                results.append(result)

                result_event = {
                    "type": "result",
                    "current": len(results),
                    "total": total,
                    "candidate": result["Candidate Name"],
                    "score": result.get("ATS Score", 0),
                    "status": "complete" if ok else "failed",
                    "data": result,
                }
                yield f"data: {json.dumps(result_event)}\n\n"

            await asyncio.sleep(0.1)

        done_event = {"type": "done", "total": total, "results": results}
        yield f"data: {json.dumps(done_event)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ─── Direct Resume Upload Endpoint (Single or Multiple PDFs) ─────────────────
@app.post("/api/analyze-direct")
async def analyze_direct_resumes(
    resume_files: list[UploadFile] = File(...),
    jd_text: Optional[str] = Form(None),
    jd_files: List[UploadFile] = File(default=[]),
    openai_key: Optional[str] = Form(None),
    gemini_key: Optional[str] = Form(None),
):
    """
    Analyze directly uploaded resume files (PDF/DOCX) against one or more JDs.
    Supports single or multiple file uploads.
    """
    final_openai_key = openai_key or OPENAI_API_KEY
    final_gemini_key = gemini_key or GEMINI_API_KEY

    # ─── Resolve Job Descriptions ─────────────────────────────────────────────
    jd_texts = await _resolve_jd_texts(jd_text, jd_files)

    if not jd_texts:
        raise HTTPException(status_code=400, detail="Job description is required.")

    if not resume_files:
        raise HTTPException(status_code=400, detail="At least one resume file is required.")

    # ─── Save uploaded files to temp and build candidate list ─────────────────
    candidates = []
    for rf in resume_files:
        ext = os.path.splitext(rf.filename)[-1].lower()
        if ext not in ('.pdf', '.docx', '.doc'):
            continue
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            file_content = await rf.read()
            tmp.write(file_content)
            tmp_path = tmp.name

        name = os.path.splitext(rf.filename)[0].replace('_', ' ').replace('-', ' ').strip()
        candidates.append((name, tmp_path))

    if not candidates:
        raise HTTPException(status_code=400, detail="No valid resume files found (PDF/DOCX only).")

    total = len(candidates)

    # ─── Processor for local files (no download needed) ───────────────────────
    def _process_local_resume(name: str, file_path: str, jd_txts: List[str], oai_key: str, gem_key: str) -> dict:
        try:
            resume_text = extract_text(file_path)
            if not resume_text:
                raise Exception("No text could be extracted from the file.")

            score_data = _score_against_all_jds(resume_text, jd_txts, oai_key, gem_key)

            # Use LLM-extracted name if available (better than filename)
            extracted_name = score_data.pop("Candidate Name Extracted", None)
            if extracted_name and extracted_name not in ("Not Found", "", None):
                name = extracted_name

            return {"Candidate Name": name, "Resume Link": f"Uploaded: {name}", **score_data, "_ok": True}
        except Exception as e:
            return {
                "Candidate Name": name,
                "Resume Link": f"Uploaded: {name}",
                "ATS Score": 0,
                "Status": "Failed",
                "Phone Number": "Error",
                "Email": "Error",
                "Photo Link": "Error",
                "Resume Summary": f"Failed: {str(e)}",
                "Missing Requirements": "Error",
                "Job Description Summary": "Error",
                "Target Job Role": "Error",
                "Best Fit Role": "Error",
                "Matched JD": "Error",
                "Recommendation": "No",
                "_ok": False,
            }
        finally:
            try:
                os.unlink(file_path)
            except OSError:
                pass

    # ─── SSE Generator with Batch Concurrency ─────────────────────────────────
    async def event_stream():
        loop = asyncio.get_event_loop()
        results = []
        completed = 0

        for batch_start in range(0, total, BATCH_SIZE):
            batch = candidates[batch_start : batch_start + BATCH_SIZE]

            for name, _ in batch:
                completed += 1
                progress_data = {
                    "type": "progress",
                    "current": completed,
                    "total": total,
                    "candidate": name,
                    "status": "processing",
                }
                yield f"data: {json.dumps(progress_data)}\n\n"

            futures = [
                loop.run_in_executor(
                    executor,
                    _process_local_resume,
                    name, fpath, jd_texts, final_openai_key, final_gemini_key,
                )
                for name, fpath in batch
            ]

            batch_results = await asyncio.gather(*futures)

            for result in batch_results:
                ok = result.pop("_ok", False)
                results.append(result)

                result_event = {
                    "type": "result",
                    "current": len(results),
                    "total": total,
                    "candidate": result["Candidate Name"],
                    "score": result.get("ATS Score", 0),
                    "status": "complete" if ok else "failed",
                    "data": result,
                }
                yield f"data: {json.dumps(result_event)}\n\n"

            await asyncio.sleep(0.1)

        done_event = {"type": "done", "total": total, "results": results}
        yield f"data: {json.dumps(done_event)}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ─── Export Endpoint ──────────────────────────────────────────────────────────
@app.post("/api/export")
async def export_results(results: list[dict]):
    """Generate styled Excel report from analysis results."""
    try:
        excel_bytes = generate_excel_bytes(results)
        return Response(
            content=excel_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=ATS_Report.xlsx"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate Excel report: {str(e)}")


# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
