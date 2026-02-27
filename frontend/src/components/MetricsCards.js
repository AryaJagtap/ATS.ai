'use client';

export default function MetricsCards({ results }) {
    const success = results.filter(
        r => ['GPT', 'Gemini', 'Keyword'].includes(r['Status'])
    );
    const avgScore = success.length > 0
        ? (success.reduce((sum, r) => sum + (r['ATS Score'] || 0), 0) / success.length).toFixed(1)
        : '0.0';
    const topScore = success.length > 0
        ? Math.max(...success.map(r => r['ATS Score'] || 0))
        : 0;

    return (
        <div className="metrics-grid">
            <div className="metric-card">
                <div className="metric-value">{results.length}</div>
                <div className="metric-label">Total Processed</div>
            </div>
            <div className="metric-card">
                <div className="metric-value">{success.length}</div>
                <div className="metric-label">Successfully Scored</div>
            </div>
            <div className="metric-card">
                <div className="metric-value">{avgScore}</div>
                <div className="metric-label">Average Score</div>
            </div>
            <div className="metric-card">
                <div className="metric-value">{topScore}</div>
                <div className="metric-label">Top Score</div>
            </div>
        </div>
    );
}
