'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import FileUpload from '@/components/FileUpload';
import JobDescription from '@/components/JobDescription';
import ProgressTracker from '@/components/ProgressTracker';
import MetricsCards from '@/components/MetricsCards';
import ResultsTable from '@/components/ResultsTable';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Home() {
  // State
  const [showSettings, setShowSettings] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [uploadMode, setUploadMode] = useState('single'); // 'single' | 'multiple'
  const [candidateFile, setCandidateFile] = useState(null);
  const [multiResumeFiles, setMultiResumeFiles] = useState([]);
  const [jdText, setJdText] = useState('');
  const [jdFiles, setJdFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, candidate: '', status: '' });
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);  // seconds
  const timerRef = useRef(null);

  // ─── Live Timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (processing) {
      setElapsedTime(0);
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [processing]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  // ─── API Status ────────────────────────────────────────────────────────────
  const getApiStatus = () => {
    if (openaiKey && geminiKey) return { text: '✅ OpenAI + Gemini Fallback', ok: true };
    if (openaiKey) return { text: '✅ OpenAI Only', ok: true };
    if (geminiKey) return { text: '✅ Gemini Only', ok: true };
    return { text: '⚙️ Using server-configured keys', ok: true };
  };

  // ─── Parse SSE Stream (shared by all modes) ───────────────────────────────
  const parseSSEStream = async (response) => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'progress') {
              setProgress({
                current: data.current,
                total: data.total,
                candidate: data.candidate,
                status: 'processing',
              });
            } else if (data.type === 'result') {
              setProgress({
                current: data.current,
                total: data.total,
                candidate: data.candidate,
                status: data.status,
              });
              setResults(prev => [...prev, data.data]);
            } else if (data.type === 'done') {
              setProgress(prev => ({
                ...prev,
                status: 'complete',
                candidate: 'Analysis Complete!',
              }));
            }
          } catch (e) {
            // Skip malformed SSE messages
          }
        }
      }
    }
  };

  // ─── Start Analysis ───────────────────────────────────────────────────────
  const startAnalysis = useCallback(async () => {
    setError('');

    // Validate inputs based on mode
    if (uploadMode === 'single') {
      if (!candidateFile) {
        setError('Please upload a resume file (PDF or DOCX).');
        return;
      }
    } else {
      if (!candidateFile && multiResumeFiles.length === 0) {
        setError('Please upload a CSV/XLSX file or select multiple resume PDFs.');
        return;
      }
    }

    if (!jdText.trim() && jdFiles.length === 0) {
      setError('Please provide a Job Description (paste text or upload file(s)).');
      return;
    }

    setProcessing(true);
    setResults([]);
    setProgress({ current: 0, total: 0, candidate: 'Initializing...', status: 'processing' });

    try {
      const formData = new FormData();

      // Add JD text (if pasted)
      if (jdText.trim()) {
        formData.append('jd_text', jdText.trim());
      }

      // Add all JD files
      for (const f of jdFiles) {
        formData.append('jd_files', f);
      }

      // Add API keys
      if (openaiKey) formData.append('openai_key', openaiKey);
      if (geminiKey) formData.append('gemini_key', geminiKey);

      let endpoint;

      if (uploadMode === 'single') {
        endpoint = `${API_URL}/api/analyze-direct`;
        formData.append('resume_files', candidateFile);
      } else if (multiResumeFiles.length > 0) {
        endpoint = `${API_URL}/api/analyze-direct`;
        for (const f of multiResumeFiles) {
          formData.append('resume_files', f);
        }
      } else {
        endpoint = `${API_URL}/api/analyze`;
        formData.append('candidate_file', candidateFile);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Analysis failed');
      }

      await parseSSEStream(response);

    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Is the backend running?');
    } finally {
      setProcessing(false);
    }
  }, [uploadMode, candidateFile, multiResumeFiles, jdText, jdFiles, openaiKey, geminiKey]);

  // ─── Export Excel ──────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    if (results.length === 0) return;
    setExporting(true);

    try {
      const response = await fetch(`${API_URL}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(results),
      });

      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ATS_Report.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to export report. Please try again.');
    } finally {
      setExporting(false);
    }
  }, [results]);

  // ─── Render ────────────────────────────────────────────────────────────────
  const apiStatus = getApiStatus();
  const hasUpload = uploadMode === 'single'
    ? !!candidateFile
    : (!!candidateFile || multiResumeFiles.length > 0);
  const hasJd = jdText.trim() || jdFiles.length > 0;
  const canStart = hasUpload && hasJd && !processing;

  return (
    <div className="app-container">
      <Header
        onSettingsToggle={() => setShowSettings(!showSettings)}
        showSettings={showSettings}
      />

      {/* Hero Section */}
      <div style={{
        textAlign: 'center',
        marginBottom: '40px',
        padding: '20px 0',
      }}>
        <h1 style={{
          fontSize: '2.4rem',
          fontWeight: 900,
          background: 'var(--accent-gradient-vibrant)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '10px',
          letterSpacing: '-1px',
          lineHeight: 1.2,
        }}>
          Score Candidates with AI Precision
        </h1>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '1.05rem',
          maxWidth: '580px',
          margin: '0 auto',
          lineHeight: 1.6,
          fontWeight: 400,
        }}>
          Upload resumes, paste a job description, and let our AI engine
          evaluate every candidate in seconds — not hours.
        </p>
        <div style={{
          width: '80px',
          height: '4px',
          background: 'var(--accent-gradient-vibrant)',
          borderRadius: '2px',
          margin: '20px auto 0',
          boxShadow: '0 0 20px var(--accent-glow)',
        }} />
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="settings-panel">
          <div style={{
            fontSize: '0.85rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            🔐 API Configuration
          </div>
          <div className="settings-grid">
            <div className="settings-field">
              <label>OpenAI API Key (Primary)</label>
              <input
                type="password"
                placeholder="sk-proj-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
              />
            </div>
            <div className="settings-field">
              <label>Gemini API Key (Fallback)</label>
              <input
                type="password"
                placeholder="AIzaSy..."
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
              />
            </div>
          </div>
          <div className={`api-status ${apiStatus.ok ? '' : 'warning'}`}>
            {apiStatus.text}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="error-banner">
          <span>⚠️</span>
          <span>{error}</span>
          <button
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: 'var(--error)', cursor: 'pointer', fontSize: '1.2rem',
              fontWeight: 700, lineHeight: 1,
            }}
            onClick={() => setError('')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload + JD Grid */}
      <div className="main-grid">
        <FileUpload
          mode={uploadMode}
          onModeChange={setUploadMode}
          file={candidateFile}
          onFileChange={setCandidateFile}
          multiFiles={multiResumeFiles}
          onMultiFilesChange={setMultiResumeFiles}
        />
        <JobDescription
          jdText={jdText}
          onJdTextChange={setJdText}
          jdFiles={jdFiles}
          onJdFilesChange={setJdFiles}
        />
      </div>

      {/* Analyze Button */}
      <button
        className="analyze-btn"
        onClick={startAnalysis}
        disabled={!canStart}
      >
        {processing ? (
          <>
            <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', marginRight: '8px' }}>⏳</span>
            Processing Candidates...
          </>
        ) : (
          '🚀  Start Analysis'
        )}
      </button>

      {/* Progress */}
      {processing && progress.total > 0 && (
        <>
          <ProgressTracker
            current={progress.current}
            total={progress.total}
            candidateName={progress.candidate}
            status={progress.status}
          />
          <div style={{
            textAlign: 'center',
            marginTop: '8px',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}>
            ⏱️ Time elapsed: <span style={{
              color: 'var(--accent-primary)',
              fontWeight: 700,
            }}>{formatTime(elapsedTime)}</span>
          </div>
        </>
      )}

      {/* Results — only show "Completed in" badge after processing finishes */}
      {results.length > 0 && (
        <>
          {!processing && (
            <div style={{
              textAlign: 'center',
              marginBottom: '16px',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 20px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontWeight: 500,
              }}>
                <span style={{ fontSize: '1.1rem' }}>⏱️</span>
                Completed in <span style={{
                  background: 'var(--accent-gradient)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontWeight: 700,
                }}>{formatTime(elapsedTime)}</span>
              </span>
            </div>
          )}
          <MetricsCards results={results} />
          <ResultsTable
            results={results}
            onExport={handleExport}
            exporting={exporting}
          />
        </>
      )}

      {/* Footer */}
      <footer className="footer">
        <p style={{
          background: 'var(--accent-gradient)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          fontWeight: 600,
          fontSize: '0.85rem',
        }}>
          ATS.ai
        </p>
        <p style={{ marginTop: '4px' }}>
          AI-Powered Candidate Scoring Engine
        </p>
      </footer>
    </div>
  );
}
