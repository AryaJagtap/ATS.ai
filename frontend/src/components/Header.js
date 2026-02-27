'use client';

import { useState, useEffect } from 'react';

export default function Header({ onSettingsToggle, showSettings }) {
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const saved = localStorage.getItem('ats-theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('ats-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <header className="header">
      <div className="header-brand">
        <div className="header-logo">🎯</div>
        <div>
          <div className="header-title">ATS.ai</div>
          <div className="header-subtitle">AI-Powered Candidate Scoring Engine</div>
        </div>
      </div>
      <div className="header-actions">
        <div className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          <div className={`theme-toggle-knob ${theme === 'light' ? 'light' : ''}`}>
            {theme === 'dark' ? '🌙' : '☀️'}
          </div>
        </div>
        <button className="settings-toggle-btn" onClick={onSettingsToggle}>
          ⚙️ {showSettings ? 'Hide' : 'Settings'}
        </button>
      </div>
    </header>
  );
}
