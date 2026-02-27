'use client';

import { useState, useRef } from 'react';

export default function JobDescription({ jdText, onJdTextChange, jdFiles, onJdFilesChange }) {
    const [activeTab, setActiveTab] = useState('paste');
    const jdInputRef = useRef(null);

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            onJdFilesChange(prev => [...prev, ...files]);
        }
        // Reset input so the same file can be re-selected
        e.target.value = '';
    };

    const removeFile = (index) => {
        onJdFilesChange(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="card">
            <div className="card-title">
                <span className="icon">📋</span>
                Job Description
            </div>

            <div className="jd-tabs">
                <button
                    className={`jd-tab ${activeTab === 'paste' ? 'active' : ''}`}
                    onClick={() => setActiveTab('paste')}
                >
                    ✏️ Paste Text
                </button>
                <button
                    className={`jd-tab ${activeTab === 'upload' ? 'active' : ''}`}
                    onClick={() => setActiveTab('upload')}
                >
                    📁 Upload File{jdFiles.length > 1 ? 's' : ''}
                </button>
            </div>

            {activeTab === 'paste' ? (
                <textarea
                    className="jd-textarea"
                    placeholder="Paste the job description here... Include required skills, experience, and qualifications for the best scoring results."
                    value={jdText}
                    onChange={(e) => onJdTextChange(e.target.value)}
                />
            ) : (
                <>
                    <div
                        className="upload-zone"
                        onClick={() => jdInputRef.current?.click()}
                    >
                        <span className="upload-icon">📄</span>
                        <div className="upload-text">Click to upload JD file(s)</div>
                        <div className="upload-hint">
                            Supports PDF, DOCX, and TXT files • Upload multiple for multi-role matching
                        </div>
                        <input
                            ref={jdInputRef}
                            type="file"
                            accept=".pdf,.docx,.txt"
                            multiple
                            onChange={handleFileSelect}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {jdFiles.length > 0 && (
                        <div style={{ marginTop: '10px' }}>
                            {jdFiles.length > 1 && (
                                <div style={{
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    marginBottom: '8px',
                                }}>
                                    {jdFiles.length} job descriptions — multi-role matching enabled
                                </div>
                            )}
                            <div style={{
                                maxHeight: '140px',
                                overflowY: 'auto',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                            }}>
                                {jdFiles.map((f, i) => (
                                    <div key={i} className="file-selected" style={{ marginTop: 0, padding: '10px 14px' }}>
                                        <span className="file-selected-name" style={{ fontSize: '0.82rem' }}>
                                            ✅ {f.name}
                                        </span>
                                        <button
                                            className="file-selected-remove"
                                            onClick={() => removeFile(i)}
                                        >
                                            ✕
                                        </button>
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
