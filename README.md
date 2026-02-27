# 🎯 ATS.ai — AI-Powered Recruitment Platform

A **production-grade, AI-powered Applicant Tracking System** that scores candidate resumes against job descriptions using LLM analysis (OpenAI GPT-4o-mini → Gemini 2.5 Flash → Keyword Fallback). Features real-time streaming progress, multi-JD matching, concurrent batch processing, and one-click Excel report export.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **Multi-LLM Cascade** | GPT-4o-mini (primary) → Gemini 2.5 Flash (fallback) → TF-IDF keyword matching (offline) |
| 📊 **ATS Scoring (0-100)** | Weighted blend of LLM semantic analysis (70%) + keyword matching (30%) |
| 📋 **Multi-JD Matching** | Upload multiple job descriptions — candidates are scored against each and matched to the best-fit role |
| ⚡ **High-Performance** | 120 resumes analyzed in ~6 minutes with batch concurrency (15 parallel) and retry logic |
| 🔄 **Real-time Streaming** | Live progress via Server-Sent Events with elapsed time counter |
| 🌙☀️ **Dark / Light Theme** | Toggle between themes with smooth transitions |
| 📁 **Drag & Drop Upload** | Upload CSV/XLSX candidate files or select multiple PDF/DOCX resumes directly |
| 📋 **JD Input** | Paste job description text or upload PDF/DOCX/TXT files |
| 📸 **Photo Link Extraction** | Auto-detects "Photograph" column from spreadsheet and includes in results |
| 📥 **Excel Export** | One-click download of styled, color-coded Excel report |
| 🔐 **API Key Config** | Enter API keys in the UI or use environment variables |
| 📱 **Responsive** | Works on desktop, tablet, and mobile |

---

## 🏗️ Architecture

```
┌─────────────────────┐         ┌──────────────────────────┐
│   Next.js Frontend  │  HTTP   │   FastAPI Backend         │
│   (Vercel)          │ ──────> │   (Render)                │
│                     │   SSE   │                           │
│  • React UI         │ <────── │  • utils/scorer.py        │
│  • Dark/Light Theme │         │  • utils/downloader.py    │
│  • Drag & Drop      │         │  • utils/extractor.py     │
│  • Live Progress    │         │  • utils/export.py        │
└─────────────────────┘         └──────────────────────────┘
```

---

## ⚡ Performance Benchmarks

| Metric | Value |
|--------|-------|
| **Per-resume analysis** | ~2-3 seconds |
| **120 resumes batch** | ~6 minutes |
| **Batch concurrency** | 15 resumes in parallel |
| **PDF extraction** | PyMuPDF (primary, ~10x faster than pdfplumber) |
| **LLM model** | gpt-4o-mini (2-3x faster than gpt-4o, same quality for structured JSON) |
| **Rate limit handling** | Auto-retry with exponential backoff (up to 2 retries per provider) |
| **Keyword + LLM scoring** | Runs in parallel via ThreadPoolExecutor |

---

## 📁 Project Structure

```
ATS-Latest/
├── frontend/                  # Next.js React app
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.js        # Main dashboard
│   │   │   ├── layout.js      # Root layout + SEO
│   │   │   ├── globals.css    # Design system (dark/light)
│   │   │   └── icon.png       # Favicon
│   │   └── components/
│   │       ├── Header.js      # Brand + theme toggle
│   │       ├── FileUpload.js  # Drag & drop upload
│   │       ├── JobDescription.js  # JD paste/upload (multi-file)
│   │       ├── MetricsCards.js    # Score summary
│   │       ├── ProgressTracker.js # Live progress bar
│   │       └── ResultsTable.js    # Sortable results + matched role
│   ├── .env.local             # Frontend env vars
│   ├── vercel.json            # Vercel deploy config
│   └── package.json
├── backend/                   # FastAPI Python app
│   ├── main.py                # REST API endpoints + batch processing
│   ├── config.py              # API key loader
│   ├── requirements.txt       # Python dependencies (pinned)
│   ├── Dockerfile             # Container for Render
│   ├── .env.example           # Env template
│   └── utils/
│       ├── scorer.py          # LLM + keyword scoring (parallel, retry)
│       ├── downloader.py      # Resume download (GDrive, Dropbox, etc.)
│       ├── extractor.py       # PDF (PyMuPDF) / DOCX / TXT extraction
│       └── export.py          # Styled Excel generation
├── render.yaml                # Render blueprint
├── .gitignore
└── README.md
```

---

## 🚀 Local Setup Guide

### Prerequisites

- **Python 3.10+** — [Download](https://www.python.org/downloads/)
- **Node.js 18+** — [Download](https://nodejs.org/)
- **Git** — [Download](https://git-scm.com/)
- **API Keys** (at least one):
  - [OpenAI API Key](https://platform.openai.com/api-keys) (recommended, uses GPT-4o-mini)
  - [Google Gemini API Key](https://aistudio.google.com/apikey) (free fallback)

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/ATS-Latest.git
cd ATS-Latest
```

---

### Step 2: Set Up the Backend (Python)

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# Windows:
venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

---

### Step 3: Configure Backend Environment Variables

```bash
# Copy the template
copy .env.example .env     # Windows
# cp .env.example .env     # macOS/Linux
```

Edit `backend/.env`:
```env
OPENAI_API_KEY=sk-proj-your-key-here
GEMINI_API_KEY=AIzaSy-your-key-here
ALLOWED_ORIGINS=http://localhost:3000
```

---

### Step 4: Start the Backend Server

```bash
uvicorn main:app --reload --port 8000
```

Verify: Open `http://localhost:8000/api/health`

---

### Step 5: Set Up the Frontend (Node.js)

Open a **new terminal** (keep the backend running):

```bash
cd frontend
npm install
```

---

### Step 6: Configure Frontend Environment

`frontend/.env.local` should contain:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

### Step 7: Start the Frontend

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

---

### Step 8: Use the Platform

1. (Optional) Click **⚙️ Settings** to enter API keys if not using `.env`
2. **Upload** a CSV/XLSX file with candidate data, or select multiple PDF resumes
3. **Enter/Upload** one or more Job Descriptions
4. Click **🚀 Start Analysis** and watch real-time progress
5. Review results in the interactive table (click ▶ to expand details)
6. Click **📥 Download Excel Report** for the styled report

---

## 🌐 Deployment Guide (Production)

### Step 9: Push to GitHub

```bash
cd ATS-Latest
git init
git add .
git commit -m "ATS.ai v2.0 — Production release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/ATS-Latest.git
git push -u origin main
```

---

### Step 10: Deploy Backend on Render

1. Go to [render.com](https://render.com) → **New +** → **Web Service**
2. Connect your **GitHub repository**
3. Configure:
   - **Name**: `ats-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Docker`
   - **Instance Type**: Free (or Starter for better performance)
4. Add **Environment Variables**:
   - `OPENAI_API_KEY` = your OpenAI key
   - `GEMINI_API_KEY` = your Gemini key
   - `ALLOWED_ORIGINS` = `https://your-app.vercel.app` (update after Step 11)
5. Click **Create Web Service** → wait ~3-5 minutes
6. Copy your backend URL (e.g., `https://ats-backend-xxxx.onrender.com`)

---

### Step 11: Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**
2. **Import** your GitHub repository
3. Configure:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `frontend`
4. Add **Environment Variable**:
   - `NEXT_PUBLIC_API_URL` = `https://ats-backend-xxxx.onrender.com` (your Render URL)
5. Click **Deploy** → wait ~1-2 minutes

---

### Step 12: Update Render CORS

Go to Render dashboard → ats-backend → Environment → Update:
- `ALLOWED_ORIGINS` = `https://your-app.vercel.app`

Redeploy the backend.

---

### Step 13: Done! 🎉

Your ATS platform is now live:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://ats-backend-xxxx.onrender.com`

> **Note**: Render free tier services spin down after 15 minutes of inactivity. The first request after idle may take ~30 seconds to cold start. For production use, consider Render's Starter plan ($7/month) to avoid cold starts.

---

## 📄 Input File Format

### CSV/XLSX Upload

Your spreadsheet must contain at minimum:

| Column | Description |
|--------|-------------|
| `Name` (or any column with "name") | Candidate name |
| `Resume URL` / `Resume Link` / any column with "url", "resume", or "link" | Direct link to resume (Google Drive, Dropbox, direct URL) |
| `Photograph` / `Photo` / `Image` (optional) | Link to candidate photo — auto-detected and included in results |

### Direct Upload

You can also select **multiple PDF/DOCX resumes** directly without a spreadsheet.

### Example CSV:
```csv
Name,Email,Resume Link,Photograph
John Doe,john@email.com,https://drive.google.com/file/d/xxx/view,https://drive.google.com/open?id=yyy
Jane Smith,jane@email.com,https://example.com/resume.pdf,
```

---

## 📊 Output Report

The exported Excel report includes:

| Column | Description |
|--------|-------------|
| Serial Number | Rank by score |
| Candidate Name | From input file or extracted by LLM |
| Phone Number | Extracted from resume |
| Email | Extracted from resume |
| Status | Engine used (GPT / Gemini / Keyword / Failed) |
| ATS Score | 0-100 weighted score |
| Resume Summary | AI-generated summary |
| Missing Requirements | Gaps vs. JD requirements |
| Job Description Summary | Key JD requirements |
| Target Job Role | Role from JD |
| Best Fit Role | Ideal role for candidate |
| Matched Role | Best-matched JD (when using multi-JD) |
| Resume Link | Original URL |
| Photo Link | From spreadsheet or resume |
| Recommendation | Yes / No / Maybe |

Scores are color-coded: 🟢 ≥70 | 🟡 ≥50 | 🔴 <50

---

## 🔧 Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Optional* | OpenAI API key for GPT-4o-mini scoring |
| `GEMINI_API_KEY` | Optional* | Google Gemini API key for fallback |
| `ALLOWED_ORIGINS` | Yes | Comma-separated allowed frontend URLs |

*At least one LLM key recommended. Without both, scoring uses keyword matching only.

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL |

---

## 🛡️ How Scoring Works

```
1. Download/extract resume text
   ├── PyMuPDF (primary — fastest PDF parser)
   └── PyPDF2 (fallback) / python-docx for DOCX
2. Score with LLM cascade (keyword + LLM run in parallel):
   ├── Try OpenAI GPT-4o-mini (primary, with retry on rate limit)
   ├── Try Gemini 2.5 Flash (fallback, with retry on rate limit)
   └── Keyword + TF-IDF (offline fallback)
3. Final Score = (LLM Score × 0.7) + (Keyword Score × 0.3)
4. If multi-JD: score against each JD, select best match
```

---

## 🔗 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, CSS Variables |
| **Backend** | FastAPI, Python 3.10+ |
| **LLM** | OpenAI GPT-4o-mini, Google Gemini 2.5 Flash |
| **PDF Parsing** | PyMuPDF (primary), PyPDF2 (fallback) |
| **NLP** | scikit-learn TF-IDF + cosine similarity |
| **Export** | openpyxl (styled Excel) |
| **Deployment** | Vercel (frontend) + Render (backend) |

---

## 📜 License

MIT License — Free for personal and commercial use.