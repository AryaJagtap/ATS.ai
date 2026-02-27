'use client';

import { useState, useRef } from 'react';

export default function FileUpload({ mode, onModeChange, file, onFileChange, multiFiles, onMultiFilesChange }) {
    const [dragOver, setDragOver] = useState(false);
    const singleInputRef = useRef(null);
    const multiFileInputRef = useRef(null);
    const csvInputRef = useRef(null);

    // ─── Single Resume Handlers ──────────────────────────────────────────────
    const handleSingleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f && (f.name.endsWith('.pdf') || f.name.endsWith('.docx') || f.name.endsWith('.doc'))) {
            onFileChange(f);
            onModeChange('single');
        }
    };

    const handleSingleSelect = (e) => {
        const f = e.target.files[0];
        if (f) {
            onFileChange(f);
            onModeChange('single');
        }
    };

    // ─── Multiple Resume Handlers ────────────────────────────────────────────
    const handleMultiDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);

        // Check if it's CSV/XLSX
        const spreadsheet = files.find(f =>
            f.name.endsWith('.csv') || f.name.endsWith('.xlsx')
        );
        if (spreadsheet) {
            onFileChange(spreadsheet);
            onMultiFilesChange([]);
            return;
        }

        // Otherwise treat as multiple PDFs
        const pdfs = files.filter(f =>
            f.name.endsWith('.pdf') || f.name.endsWith('.docx') || f.name.endsWith('.doc')
        );
        if (pdfs.length > 0) {
            onMultiFilesChange(pdfs);
            onFileChange(null);
        }
    };

    const handleCsvSelect = (e) => {
        const f = e.target.files[0];
        if (f) {
            onFileChange(f);
            onMultiFilesChange([]);
        }
    };

    const handleMultiPdfSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            onMultiFilesChange(files);
            onFileChange(null);
        }
    };

    const removeFile = () => {
        onFileChange(null);
        onMultiFilesChange([]);
    };

    const removeMultiFile = (index) => {
        const updated = multiFiles.filter((_, i) => i !== index);
        onMultiFilesChange(updated);
    };

    return (
        <div className="card">
            <div className="card-title">
                <span className="icon">📄</span> Upload Candidates
            </div>

            {/* Mode Tabs */}
            <div className="jd-tabs" style={{ marginBottom: '18px' }}>
                <button
                    className={`jd-tab ${mode === 'single' ? 'active' : ''}`}
                    onClick={() => onModeChange('single')}
                >
                    👤 Single Resume
                </button>
                <button
                    className={`jd-tab ${mode === 'multiple' ? 'active' : ''}`}
                    onClick={() => onModeChange('multiple')}
                >
                    👥 Multiple Resumes
                </button>
            </div>

            {/* ─── Single Resume Mode ─────────────────────────────────────────── */}
            {mode === 'single' && (
                <>
                    <div
                        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleSingleDrop}
                        onClick={() => singleInputRef.current?.click()}
                    >
                        <span className="upload-icon">📋</span>
                        <div className="upload-text">Drop a resume or click to upload</div>
                        <div className="upload-hint">Supports PDF, DOCX files • Single candidate</div>
                        <input
                            type="file"
                            ref={singleInputRef}
                            accept=".pdf,.docx,.doc"
                            onChange={handleSingleSelect}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {file && (
                        <div className="file-selected">
                            <span className="file-selected-name">📄 {file.name}</span>
                            <button className="file-selected-remove" onClick={removeFile}>✕</button>
                        </div>
                    )}
                </>
            )}

            {/* ─── Multiple Resume Mode ───────────────────────────────────────── */}
            {mode === 'multiple' && (
                <>
                    <div
                        className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleMultiDrop}
                        style={{ marginBottom: '12px' }}
                    >
                        <span className="upload-icon">📁</span>
                        <div className="upload-text">Drop files here or use buttons below</div>
                        <div className="upload-hint">
                            Drop CSV/XLSX file or multiple PDF/DOCX resumes
                        </div>
                    </div>

                    {/* Two action buttons */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px',
                        marginBottom: '12px',
                    }}>
                        <button
                            type="button"
                            onClick={() => csvInputRef.current?.click()}
                            style={{
                                padding: '12px 16px',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-family)',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                transition: 'all 0.3s',
                                textAlign: 'center',
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.borderColor = 'var(--accent-1)';
                                e.target.style.color = 'var(--text-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.borderColor = 'var(--border-color)';
                                e.target.style.color = 'var(--text-secondary)';
                            }}
                        >
                            📊 Upload CSV / XLSX
                        </button>
                        <button
                            type="button"
                            onClick={() => multiFileInputRef.current?.click()}
                            style={{
                                padding: '12px 16px',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontFamily: 'var(--font-family)',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                transition: 'all 0.3s',
                                textAlign: 'center',
                            }}
                            onMouseEnter={(e) => {
                                e.target.style.borderColor = 'var(--accent-1)';
                                e.target.style.color = 'var(--text-primary)';
                            }}
                            onMouseLeave={(e) => {
                                e.target.style.borderColor = 'var(--border-color)';
                                e.target.style.color = 'var(--text-secondary)';
                            }}
                        >
                            📄 Select Multiple PDFs
                        </button>
                    </div>

                    {/* Hidden file inputs */}
                    <input
                        type="file"
                        ref={csvInputRef}
                        accept=".csv,.xlsx"
                        onChange={handleCsvSelect}
                        style={{ display: 'none' }}
                    />
                    <input
                        type="file"
                        ref={multiFileInputRef}
                        accept=".pdf,.docx,.doc"
                        multiple
                        onChange={handleMultiPdfSelect}
                        style={{ display: 'none' }}
                    />

                    {/* Show selected CSV/XLSX */}
                    {file && (
                        <div className="file-selected">
                            <span className="file-selected-name">📊 {file.name}</span>
                            <button className="file-selected-remove" onClick={removeFile}>✕</button>
                        </div>
                    )}

                    {/* Show selected multiple PDFs */}
                    {multiFiles && multiFiles.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                            <div style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '1px',
                                marginBottom: '8px',
                            }}>
                                {multiFiles.length} resume{multiFiles.length > 1 ? 's' : ''} selected
                            </div>
                            <div style={{
                                maxHeight: '160px',
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                            }}>
                                {multiFiles.map((f, i) => (
                                    <div key={i} className="file-selected" style={{ marginTop: 0, padding: '10px 14px' }}>
                                        <span className="file-selected-name" style={{ fontSize: '0.82rem' }}>
                                            📄 {f.name}
                                        </span>
                                        <button className="file-selected-remove" onClick={() => removeMultiFile(i)}>✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
