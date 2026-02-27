import os
from dotenv import load_dotenv

load_dotenv()

# ─── API KEYS ──────────────────────────────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

# ─── SCORING WEIGHTS ───────────────────────────────────────────────────────────
LLM_WEIGHT     = 0.7    # 70% from LLM (semantic understanding)
KEYWORD_WEIGHT = 0.3    # 30% from keyword matching (fallback logic)