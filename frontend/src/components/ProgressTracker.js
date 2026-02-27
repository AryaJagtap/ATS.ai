'use client';

export default function ProgressTracker({ current, total, candidateName, status }) {
    const pct = total > 0 ? (current / total) * 100 : 0;

    return (
        <div className="progress-section">
            <div className="progress-card">
                <div className="progress-header">
                    <div className="progress-title">⚡ Analysis in Progress</div>
                    <div className="progress-count">{current} / {total}</div>
                </div>
                <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="progress-current">
                    {status === 'processing' && <div className="progress-spinner" />}
                    {status === 'processing'
                        ? `Processing: ${candidateName}`
                        : status === 'complete'
                            ? `✅ Completed: ${candidateName}`
                            : `❌ Failed: ${candidateName}`
                    }
                </div>
            </div>
        </div>
    );
}
