import re
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from config import LLM_WEIGHT, KEYWORD_WEIGHT

# ─── Pre-compiled regex (avoid re-compiling per call) ─────────────────────────
_TECH_PATTERN = re.compile(r'\b[A-Z][a-zA-Z0-9+#.]*\b')
_JSON_FENCE_OPEN = re.compile(r"```json\s*")
_JSON_FENCE_CLOSE = re.compile(r"```\s*")

# ─── Pre-import heavy modules at startup ──────────────────────────────────────
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ─── Reusable client singletons (avoid re-creation per call) ──────────────────
_openai_clients = {}   # api_key -> client
_gemini_clients = {}   # api_key -> client

COMMON_SKILLS = frozenset([
    "python", "java", "javascript", "typescript", "c++", "c#", "ruby", "go",
    "php", "swift", "kotlin", "r", "scala", "rust", "react", "angular", "vue",
    "django", "flask", "fastapi", "node", "express", "sql", "mysql", "postgresql",
    "mongodb", "redis", "elasticsearch", "aws", "azure", "gcp", "docker", "kubernetes",
    "machine learning", "deep learning", "nlp", "tensorflow", "pytorch",
    "pandas", "numpy", "scikit-learn", "communication", "leadership", "agile"
])

# Thread pool for running keyword + LLM in parallel
_scorer_pool = ThreadPoolExecutor(max_workers=2)


def _extract_keywords(text: str) -> set:
    text_lower = text.lower()
    found = {skill for skill in COMMON_SKILLS if skill in text_lower}
    tech_matches = _TECH_PATTERN.findall(text)
    found.update(word.lower() for word in tech_matches if len(word) > 2)
    return found


def _tfidf_similarity(resume_text: str, jd_text: str) -> float:
    try:
        vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
        vectors = vectorizer.fit_transform([resume_text, jd_text])
        return float(cosine_similarity(vectors[0:1], vectors[1:2])[0][0])
    except Exception:
        return 0.0


def keyword_score(resume_text: str, jd_text: str) -> dict:
    jd_keywords = _extract_keywords(jd_text)
    resume_keywords = _extract_keywords(resume_text)
    matched = jd_keywords & resume_keywords
    missing = jd_keywords - resume_keywords

    match_ratio = len(matched) / len(jd_keywords) if jd_keywords else 0.0
    tfidf_sim = _tfidf_similarity(resume_text, jd_text)

    combined = (match_ratio * 0.6) + (tfidf_sim * 0.4)
    return {
        "score": round(combined * 100, 1),
        "matched_keywords": sorted(list(matched)),
        "missing_keywords": sorted(list(missing))[:10],
    }


def _build_prompt(resume_text: str, jd_text: str) -> str:
    return f"""You are an objective ATS evaluator. Score the resume against the JD.
RETURN JSON ONLY. No markdown.

Rules:
- Evaluate strictly on objective alignment between resume and JD
- No bias regarding gender, race, age, or formatting
- Evidence-based only — do not infer unstated skills

FORMAT:
{{
  "candidate_name": "<full name from resume>",
  "overall_score": <0-100>,
  "phone_number": "<from resume or 'Not Found'>",
  "email": "<from resume or 'Not Found'>",
  "photo_link": "<profile/photo link if present, else 'Not Found'>",
  "summary": "<2-3 sentence background overview>",
  "missing_requirements": ["<gap1>", "<gap2>"],
  "job_description_summary": "<1-2 sentence JD summary>",
  "target_job_role": "<position title from JD>",
  "best_fit_role": "<ideal role for candidate based on resume>",
  "recommendation": "<Yes | No | Maybe>"
}}

JD: {jd_text[:3000]}
RESUME: {resume_text[:4000]}"""


def _get_openai_client(api_key: str):
    if api_key not in _openai_clients:
        import openai
        _openai_clients[api_key] = openai.OpenAI(api_key=api_key)
    return _openai_clients[api_key]


def _get_gemini_client(api_key: str):
    if api_key not in _gemini_clients:
        from google import genai
        _gemini_clients[api_key] = genai.Client(api_key=api_key)
    return _gemini_clients[api_key]


import time

# Max retries per LLM provider before falling through
_MAX_RETRIES = 2

def llm_score(resume_text: str, jd_text: str, openai_key: str, gemini_key: str) -> dict | None:
    prompt = _build_prompt(resume_text, jd_text)

    # ─── ATTEMPT 1: OpenAI (Primary) with retry ───────────────────────────────
    if openai_key:
        client = _get_openai_client(openai_key)
        for attempt in range(_MAX_RETRIES + 1):
            try:
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "You are an expert ATS evaluator. Return ONLY valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0,
                    max_tokens=500,
                )
                raw_text = response.choices[0].message.content.strip()
                result = json.loads(raw_text)
                result["llm_provider"] = "GPT"
                return result
            except Exception as e:
                err_str = str(e).lower()
                is_retryable = "rate" in err_str or "429" in err_str or "timeout" in err_str or "overloaded" in err_str
                if is_retryable and attempt < _MAX_RETRIES:
                    wait = (attempt + 1) * 1.5  # 1.5s, 3s
                    print(f"⏳ OpenAI rate limited (attempt {attempt+1}), retrying in {wait}s...")
                    time.sleep(wait)
                else:
                    print(f"⚠️ OpenAI failed: {e}. Trying Gemini fallback...")
                    break

    # ─── ATTEMPT 2: Gemini (Fallback) with retry ──────────────────────────────
    if gemini_key:
        client = _get_gemini_client(gemini_key)
        for attempt in range(_MAX_RETRIES + 1):
            try:
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                )
                raw_text = _JSON_FENCE_OPEN.sub("", response.text.strip())
                raw_text = _JSON_FENCE_CLOSE.sub("", raw_text).strip()
                result = json.loads(raw_text)
                result["llm_provider"] = "Gemini"
                return result
            except Exception as e:
                err_str = str(e).lower()
                is_retryable = "rate" in err_str or "429" in err_str or "quota" in err_str or "resource" in err_str
                if is_retryable and attempt < _MAX_RETRIES:
                    wait = (attempt + 1) * 1.5
                    print(f"⏳ Gemini rate limited (attempt {attempt+1}), retrying in {wait}s...")
                    time.sleep(wait)
                else:
                    print(f"⚠️ Gemini failed: {e}.")
                    break

    return None


def score_resume(resume_text: str, jd_text: str, openai_key: str, gemini_key: str) -> dict:
    # Run keyword scoring and LLM scoring IN PARALLEL
    kw_future = _scorer_pool.submit(keyword_score, resume_text, jd_text)
    llm_future = _scorer_pool.submit(llm_score, resume_text, jd_text, openai_key, gemini_key)

    kw_result = kw_future.result()
    llm_result = llm_future.result()

    if llm_result:
        final = round((llm_result.get("overall_score", 0) * LLM_WEIGHT) + (kw_result["score"] * KEYWORD_WEIGHT), 1)

        # Format Recommendation Strictly
        rec = str(llm_result.get("recommendation", "Maybe")).capitalize()
        if rec not in ["Yes", "No", "Maybe"]:
            rec = "Maybe"

        return {
            "ATS Score": final,
            "Phone Number": llm_result.get("phone_number", "Not Found"),
            "Email": llm_result.get("email", "Not Found"),
            "Photo Link": llm_result.get("photo_link", "Not Found"),
            "Resume Summary": llm_result.get("summary", ""),
            "Missing Requirements": ", ".join(llm_result.get("missing_requirements", [])),
            "Job Description Summary": llm_result.get("job_description_summary", ""),
            "Target Job Role": llm_result.get("target_job_role", ""),
            "Best Fit Role": llm_result.get("best_fit_role", ""),
            "Recommendation": rec,
            "Status": llm_result.get("llm_provider", "GPT"),
            "Candidate Name Extracted": llm_result.get("candidate_name", ""),
        }
    else:
        return {
            "ATS Score": kw_result["score"],
            "Phone Number": "Not Found",
            "Email": "Not Found",
            "Photo Link": "Not Found",
            "Resume Summary": "LLMs failed or keys missing. Scored via keywords only.",
            "Missing Requirements": ", ".join(kw_result["missing_keywords"]),
            "Job Description Summary": "Not Found",
            "Target Job Role": "Not Found",
            "Best Fit Role": "Not Found",
            "Recommendation": "Maybe",
            "Status": "Keyword"
        }