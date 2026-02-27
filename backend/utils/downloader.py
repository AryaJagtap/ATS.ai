import os
import re
import uuid
import tempfile
import requests
import gdown

TEMP_DIR = os.path.join(tempfile.gettempdir(), "ats_downloads")

def _ensure_temp_dir():
    os.makedirs(TEMP_DIR, exist_ok=True)

def _save_path(extension="pdf"):
    _ensure_temp_dir()
    return os.path.join(TEMP_DIR, f"resume_{uuid.uuid4().hex}.{extension}")

def detect_url_type(url: str) -> str:
    url_lower = url.lower()
    if "drive.google.com" in url_lower or "docs.google.com" in url_lower:
        return "google_drive"
    elif "dropbox.com" in url_lower:
        return "dropbox"
    elif "onedrive.live.com" in url_lower or "1drv.ms" in url_lower or "sharepoint.com" in url_lower:
        return "onedrive"
    else:
        return "direct"

def _extract_gdrive_file_id(url: str) -> str | None:
    patterns = [
        r"/file/d/([a-zA-Z0-9_-]+)",
        r"id=([a-zA-Z0-9_-]+)",
        r"/d/([a-zA-Z0-9_-]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None

def download_from_google_drive(url: str) -> str | None:
    file_id = _extract_gdrive_file_id(url)
    if not file_id:
        return None
    save_path = _save_path("pdf")
    try:
        gdown.download(id=file_id, output=save_path, quiet=True, fuzzy=True)
        if os.path.exists(save_path) and os.path.getsize(save_path) > 0:
            return save_path
    except Exception:
        pass
    return None

def download_from_dropbox(url: str) -> str | None:
    direct_url = url.replace("www.dropbox.com", "dl.dropboxusercontent.com")
    direct_url = re.sub(r"[?&]dl=0", "", direct_url)
    direct_url = re.sub(r"\?dl=1", "", direct_url)
    direct_url += "&dl=1" if "?" in direct_url else "?dl=1"
    return _download_direct(direct_url)

def download_from_onedrive(url: str) -> str | None:
    direct_url = url.replace("redir?", "download?").replace("embed?", "download?")
    return _download_direct(direct_url)

def _detect_extension(response: requests.Response, url: str) -> str:
    content_type = response.headers.get("Content-Type", "")
    if "pdf" in content_type: return "pdf"
    elif "word" in content_type or "docx" in content_type: return "docx"
    elif url.lower().endswith(".docx"): return "docx"
    elif url.lower().endswith(".doc"): return "doc"
    return "pdf"

def _download_direct(url: str) -> str | None:
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        response = requests.get(url, headers=headers, timeout=30, allow_redirects=True)
        response.raise_for_status()
        save_path = _save_path(_detect_extension(response, url))
        with open(save_path, "wb") as f:
            f.write(response.content)
        if os.path.getsize(save_path) > 0:
            return save_path
    except Exception:
        pass
    return None

def download_resume(url: str) -> str | None:
    if not url or not isinstance(url, str) or url.strip() == "":
        return None
    url = url.strip()
    url_type = detect_url_type(url)
    if url_type == "google_drive": return download_from_google_drive(url)
    elif url_type == "dropbox": return download_from_dropbox(url)
    elif url_type == "onedrive": return download_from_onedrive(url)
    else: return _download_direct(url)