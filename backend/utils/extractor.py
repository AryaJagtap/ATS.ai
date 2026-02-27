import os
import logging

# Suppress noisy pdfminer font warnings ("Could not get FontBBox...")
logging.getLogger("pdfminer").setLevel(logging.ERROR)


def _extract_pdf_with_pymupdf(file_path: str) -> str:
    """Primary extractor — PyMuPDF (fitz). Fastest PDF parser available."""
    try:
        import fitz  # PyMuPDF
        text_parts = []
        with fitz.open(file_path) as doc:
            for page in doc:
                page_text = page.get_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n".join(text_parts)
    except Exception:
        return ""


def _extract_pdf_with_pypdf2(file_path: str) -> str:
    """Fallback extractor — PyPDF2."""
    try:
        import PyPDF2
        text_parts = []
        with open(file_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n".join(text_parts)
    except Exception:
        return ""


def extract_text_from_pdf(file_path: str) -> str:
    """Try PyMuPDF first (fast), fall back to PyPDF2 if needed."""
    text = _extract_pdf_with_pymupdf(file_path)
    if not text.strip():
        text = _extract_pdf_with_pypdf2(file_path)
    return text.strip()


def extract_text_from_docx(file_path: str) -> str:
    try:
        from docx import Document
        doc = Document(file_path)
        return "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
    except Exception:
        return ""


def extract_text(file_path: str) -> str:
    if not file_path or not os.path.exists(file_path):
        return ""
    ext = os.path.splitext(file_path)[-1].lower()
    if ext == ".pdf":
        text = extract_text_from_pdf(file_path)
    elif ext in [".docx", ".doc"]:
        text = extract_text_from_docx(file_path)
    elif ext == ".txt":
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
        except Exception:
            text = ""
    else:
        text = extract_text_from_pdf(file_path)
    return text