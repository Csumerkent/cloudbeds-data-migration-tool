import { useState, useMemo } from 'react';
import { getLogs, clearLogs, getModules, type LogEntry, type LogLevel } from '../../services/debugLogger';
import './pages.css';

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: '#6a1b9a',
  INFO: '#2e7d32',
  WARN: '#f57c00',
  ERROR: '#c62828',
};

const ALL_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

function DebugTool() {
  const [logs, setLogs] = useState<LogEntry[]>(() => [...getLogs()]);
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const modules = useMemo(() => {
    const m = getModules();
    // Also check current logs in case getModules hasn't updated
    const fromLogs = [...new Set(logs.map((l) => l.module))];
    return [...new Set([...m, ...fromLogs])].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    let result = logs;
    if (levelFilter !== 'ALL') {
      result = result.filter((l) => l.level === levelFilter);
    }
    if (moduleFilter !== 'ALL') {
      result = result.filter((l) => l.module === moduleFilter);
    }
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(lower) ||
          l.step.toLowerCase().includes(lower) ||
          l.module.toLowerCase().includes(lower) ||
          (l.payload && JSON.stringify(l.payload).toLowerCase().includes(lower)),
      );
    }
    return result;
  }, [logs, levelFilter, moduleFilter, search]);

  const handleRefresh = () => {
    setLogs([...getLogs()]);
  };

  const handleClear = () => {
    clearLogs();
    setLogs([]);
    setExpandedRow(null);
  };

  const copyRow = (entry: LogEntry) => {
    const text = `[${entry.timestamp}] ${entry.level} ${entry.module}/${entry.step}: ${entry.message}${entry.payload ? '\n' + JSON.stringify(entry.payload, null, 2) : ''}`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const toggleRow = (index: number) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  return (
    <div className="config-page" style={{ maxWidth: 1100 }}>
      <h3>Debug Tool</h3>

      <div className="config-note config-note--compact">
        Session-based debug log. Entries are in memory only and reset on app close.
      </div>

      {/* Controls */}
      <div className="debug-controls">
        <button className="btn btn-primary" onClick={handleRefresh}>Refresh</button>
        <button className="btn btn-secondary" onClick={handleClear}>Clear</button>

        <select
          className="debug-select"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LogLevel | 'ALL')}
        >
          <option value="ALL">All Levels</option>
          {ALL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>

        <select
          className="debug-select"
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
        >
          <option value="ALL">All Modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <input
          className="debug-search"
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <span className="debug-count">{filtered.length} / {logs.length}</span>
      </div>

      {/* Log table */}
      {filtered.length === 0 ? (
        <div className="status-area status-area--idle">No log entries match.</div>
      ) : (
        <div className="scrollable-list" style={{ maxHeight: 500 }}>
          <table className="compact-table">
            <thead>
              <tr>
                <th style={{ width: 150 }}>Time</th>
                <th style={{ width: 50 }}>Level</th>
                <th style={{ width: 100 }}>Module</th>
                <th style={{ width: 100 }}>Step</th>
                <th>Message</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry, i) => {
                const globalIdx = logs.indexOf(entry);
                const isExpanded = expandedRow === globalIdx;
                const hasPayload = entry.payload !== undefined;
                return (
                  <tr key={globalIdx} onClick={() => hasPayload && toggleRow(globalIdx)} style={{ cursor: hasPayload ? 'pointer' : 'default' }}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{entry.timestamp}</td>
                    <td style={{ color: LEVEL_COLORS[entry.level] ?? '#444', fontWeight: 600, fontSize: '0.75rem' }}>{entry.level}</td>
                    <td style={{ fontSize: '0.78rem' }}>{entry.module}</td>
                    <td style={{ fontSize: '0.78rem', color: '#666' }}>{entry.step}</td>
                    <td style={{ fontSize: '0.78rem' }}>
                      {entry.message}
                      {isExpanded && hasPayload && (
                        <pre className="debug-payload">{JSON.stringify(entry.payload, null, 2)}</pre>
                      )}
                      {!isExpanded && hasPayload && (
                        <span className="debug-payload-hint"> [+]</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="debug-copy-btn"
                        onClick={(e) => { e.stopPropagation(); copyRow(entry); }}
                        title="Copy"
                      >
                        CP
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DebugTool;
