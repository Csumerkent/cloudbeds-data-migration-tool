import { useState } from 'react';
import { getLogs, clearLogs, type LogEntry } from '../../services/debugLogger';
import './pages.css';

const LEVEL_COLORS: Record<string, string> = {
  INFO: '#2e7d32',
  WARN: '#f57c00',
  ERROR: '#c62828',
};

function DebugTool() {
  const [logs, setLogs] = useState<LogEntry[]>(() => getLogs());

  const handleRefresh = () => {
    setLogs([...getLogs()]);
  };

  const handleClear = () => {
    clearLogs();
    setLogs([]);
  };

  return (
    <div className="config-page" style={{ maxWidth: 960 }}>
      <h3>Debug Tool</h3>

      <div className="config-note config-note--compact">
        Session-based debug log. Entries are stored in memory only and reset when the
        application is closed. Click Refresh to see the latest entries.
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={handleRefresh}>
          Refresh
        </button>
        <button className="btn btn-secondary" onClick={handleClear}>
          Clear
        </button>
        <span style={{ fontSize: '0.8rem', color: '#888', alignSelf: 'center' }}>
          {logs.length} entries
        </span>
      </div>

      {logs.length === 0 ? (
        <div className="status-area status-area--idle">No log entries yet.</div>
      ) : (
        <div className="scrollable-list" style={{ maxHeight: 400 }}>
          <table className="compact-table">
            <thead>
              <tr>
                <th style={{ width: 160 }}>Timestamp</th>
                <th style={{ width: 55 }}>Level</th>
                <th style={{ width: 110 }}>Module</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{entry.timestamp}</td>
                  <td style={{ color: LEVEL_COLORS[entry.level] ?? '#444', fontWeight: 600 }}>{entry.level}</td>
                  <td>{entry.module}</td>
                  <td>
                    {entry.message}
                    {entry.payload !== undefined && (
                      <span style={{ color: '#888', marginLeft: 8, fontSize: '0.75rem' }}>
                        {JSON.stringify(entry.payload)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DebugTool;
