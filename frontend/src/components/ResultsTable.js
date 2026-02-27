'use client';

import { useState, Fragment } from 'react';

export default function ResultsTable({ results, onExport, exporting }) {
    const [sortField, setSortField] = useState('ATS Score');
    const [sortDir, setSortDir] = useState('desc');
    const [expandedRow, setExpandedRow] = useState(null);

    // Show Matched JD column only when multi-JD data is present
    const hasMatchedJD = results.some(r => r['Matched JD'] && r['Matched JD'] !== 'Single JD' && r['Matched JD'] !== 'Error');

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const sorted = [...results].sort((a, b) => {
        const aVal = a[sortField] ?? '';
        const bVal = b[sortField] ?? '';
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortDir === 'asc'
            ? String(aVal).localeCompare(String(bVal))
            : String(bVal).localeCompare(String(aVal));
    });

    const getScoreClass = (score) => {
        if (score >= 70) return 'high';
        if (score >= 50) return 'medium';
        return 'low';
    };

    const getRecClass = (rec) => {
        const r = (rec || '').toLowerCase();
        if (r === 'yes') return 'yes';
        if (r === 'no') return 'no';
        return 'maybe';
    };

    const getStatusClass = (status) => {
        const s = (status || '').toLowerCase();
        if (s === 'gpt') return 'gpt';
        if (s === 'gemini') return 'gemini';
        if (s === 'keyword') return 'keyword';
        return 'failed';
    };

    const columns = [
        { key: 'expand', label: '', sortable: false },
        { key: 'Candidate Name', label: 'Candidate', sortable: true },
        { key: 'ATS Score', label: 'Score', sortable: true },
        ...(hasMatchedJD ? [{ key: 'Matched JD', label: 'Matched Role', sortable: true }] : []),
        { key: 'Best Fit Role', label: 'Best Fit Role', sortable: true },
        { key: 'Recommendation', label: 'Recommendation', sortable: true },
        { key: 'Status', label: 'Engine', sortable: true },
    ];

    const renderSortIcon = (key) => {
        if (sortField !== key) return <span className="sort-icon">↕</span>;
        return <span className="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>;
    };

    return (
        <div className="results-section">
            <div className="results-header">
                <div className="results-title">
                    <span>📊</span> Detailed Results
                </div>
                <button
                    className="export-btn"
                    onClick={onExport}
                    disabled={exporting}
                >
                    {exporting ? '⏳ Generating...' : '⬇️ Download Excel Report'}
                </button>
            </div>

            <div className="table-container">
                <table className="results-table">
                    <thead>
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                    className={sortField === col.key ? 'sorted' : ''}
                                    style={!col.sortable ? { cursor: 'default', width: '40px' } : {}}
                                >
                                    {col.label}
                                    {col.sortable && renderSortIcon(col.key)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((row, idx) => (
                            <Fragment key={idx}>
                                <tr>
                                    <td>
                                        <button
                                            className="row-expand-btn"
                                            onClick={() => setExpandedRow(expandedRow === idx ? null : idx)}
                                        >
                                            {expandedRow === idx ? '▼' : '▶'}
                                        </button>
                                    </td>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                        {row['Candidate Name']}
                                    </td>
                                    <td>
                                        <span className={`score-badge ${getScoreClass(row['ATS Score'])}`}>
                                            {row['ATS Score']}/100
                                        </span>
                                    </td>
                                    {hasMatchedJD && (
                                        <td>
                                            <span style={{
                                                background: 'var(--accent-gradient)',
                                                WebkitBackgroundClip: 'text',
                                                WebkitTextFillColor: 'transparent',
                                                backgroundClip: 'text',
                                                fontWeight: 600,
                                                fontSize: '0.82rem',
                                            }}>
                                                {row['Matched JD'] || '—'}
                                            </span>
                                        </td>
                                    )}
                                    <td>{row['Best Fit Role'] || '—'}</td>
                                    <td>
                                        <span className={`rec-badge ${getRecClass(row['Recommendation'])}`}>
                                            {row['Recommendation'] === 'Yes' && '✅ '}
                                            {row['Recommendation'] === 'No' && '❌ '}
                                            {row['Recommendation'] === 'Maybe' && '🤔 '}
                                            {row['Recommendation']}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${getStatusClass(row['Status'])}`}>
                                            {row['Status']}
                                        </span>
                                    </td>
                                </tr>
                                {expandedRow === idx && (
                                    <tr className="expanded-row" key={`exp-${idx}`}>
                                        <td colSpan={columns.length}>
                                            <div className="expanded-content">
                                                <div className="detail-grid">
                                                    <div className="detail-item">
                                                        <div className="detail-label">Phone Number</div>
                                                        <div className="detail-value">{row['Phone Number'] || 'Not Found'}</div>
                                                    </div>
                                                    <div className="detail-item">
                                                        <div className="detail-label">Email</div>
                                                        <div className="detail-value">{row['Email'] || 'Not Found'}</div>
                                                    </div>
                                                    <div className="detail-item">
                                                        <div className="detail-label">Target Job Role</div>
                                                        <div className="detail-value">{row['Target Job Role'] || '—'}</div>
                                                    </div>
                                                    <div className="detail-item">
                                                        <div className="detail-label">Best Fit Role</div>
                                                        <div className="detail-value">{row['Best Fit Role'] || '—'}</div>
                                                    </div>
                                                    {row['Matched JD'] && (
                                                        <div className="detail-item">
                                                            <div className="detail-label">Matched JD Role</div>
                                                            <div className="detail-value" style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{row['Matched JD']}</div>
                                                        </div>
                                                    )}
                                                    <div className="detail-item full-width">
                                                        <div className="detail-label">Resume Summary</div>
                                                        <div className="detail-value">{row['Resume Summary'] || '—'}</div>
                                                    </div>
                                                    <div className="detail-item full-width">
                                                        <div className="detail-label">Missing Requirements</div>
                                                        <div className="detail-value">{row['Missing Requirements'] || 'None'}</div>
                                                    </div>
                                                    <div className="detail-item full-width">
                                                        <div className="detail-label">Job Description Summary</div>
                                                        <div className="detail-value">{row['Job Description Summary'] || '—'}</div>
                                                    </div>
                                                    <div className="detail-item">
                                                        <div className="detail-label">Resume Link</div>
                                                        <div className="detail-value">
                                                            <a href={row['Resume Link']} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)' }}>
                                                                Open Resume ↗
                                                            </a>
                                                        </div>
                                                    </div>
                                                    <div className="detail-item">
                                                        <div className="detail-label">Photo Link</div>
                                                        <div className="detail-value">{row['Photo Link'] || 'Not Found'}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
