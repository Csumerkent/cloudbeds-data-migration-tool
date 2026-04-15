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

type DebugTab = 'all' | 'migration';

// Steps that are useful for deep debugging but add noise to the operator's
// Migration view. Suppressed from the Migration tab only — All Logs is
// unaffected so these entries are still reachable when needed.
const MIGRATION_TAB_NOISY_STEPS = new Set<string>([
  'normalize',
  'resolve',
  'payload',
  'row-summary',
  'send',
  'response',
  'api-error-raw',
  'success',
  'skip',
]);

function DebugTool() {
  const [logs, setLogs] = useState<LogEntry[]>(() => [...getLogs()]);
  const [activeTab, setActiveTab] = useState<DebugTab>('all');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Migration-only logs (separate source for the Migration tab).
  // Migration logs are displayed newest-first so the most recent activity
  // (including the final summary) is always visible at the top without
  // scrolling.
  const migrationLogs = useMemo(() => {
    return [...logs]
      .filter((l) => l.module === 'Migration')
      .filter((l) => {
        // Keep all warnings / errors; drop noisy per-row debug steps.
        if (l.level === 'WARN' || l.level === 'ERROR') return true;
        return !MIGRATION_TAB_NOISY_STEPS.has(l.step);
      })
      .reverse();
  }, [logs]);

  // Base set for current tab
  const baseLogs = activeTab === 'migration' ? migrationLogs : logs;

  const modules = useMemo(() => {
    const m = getModules();
    const fromLogs = [...new Set(logs.map((l) => l.module))];
    return [...new Set([...m, ...fromLogs])].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    let result = baseLogs;
    if (levelFilter !== 'ALL') {
      result = result.filter((l) => l.level === levelFilter);
    }
    // Module filter only applies on All tab
    if (activeTab === 'all' && moduleFilter !== 'ALL') {
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
  }, [baseLogs, activeTab, levelFilter, moduleFilter, search]);

  const handleRefresh = () => {
    setLogs([...getLogs()]);
  };

  const handleClear = () => {
    clearLogs();
    setLogs([]);
    setExpandedRows(new Set());
  };

  const copyRow = (entry: LogEntry) => {
    const text = `[${entry.timestamp}] ${entry.level} ${entry.module}/${entry.step}: ${entry.message}${entry.payload ? '\n' + JSON.stringify(entry.payload, null, 2) : ''}`;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const toggleRow = (index: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const expandAll = () => {
    const indices = new Set<number>();
    filtered.forEach((entry) => {
      if (entry.payload !== undefined) {
        indices.add(baseLogs.indexOf(entry));
      }
    });
    setExpandedRows(indices);
  };

  const collapseAll = () => {
    setExpandedRows(new Set());
  };

  const switchTab = (tab: DebugTab) => {
    setActiveTab(tab);
    setExpandedRows(new Set());
    // Reset module filter when switching to Migration tab
    if (tab === 'migration') {
      setModuleFilter('ALL');
    }
  };

  const migrationCount = migrationLogs.length;

  // Determine which columns to show based on tab
  const showModule = activeTab === 'all';

  return (
    <div className="config-page" style={{ maxWidth: 1100 }}>
      <h3>Debug Tool</h3>

      {/* Tab bar */}
      <div className="debug-tabs">
        <button
          className={`debug-tab${activeTab === 'all' ? ' debug-tab--active' : ''}`}
          onClick={() => switchTab('all')}
        >
          All Logs
        </button>
        <button
          className={`debug-tab${activeTab === 'migration' ? ' debug-tab--active' : ''}`}
          onClick={() => switchTab('migration')}
        >
          Migration{migrationCount > 0 ? ` (${migrationCount})` : ''}
        </button>
      </div>

      {activeTab === 'all' && (
        <div className="config-note config-note--compact">
          Session-based debug log. Entries are in memory only and reset on app close.
        </div>
      )}

      {activeTab === 'migration' && (
        <div className="config-note config-note--compact">
          Migration logs: start, validation, batches, cancellation, HTTP / API errors, and final summaries. Per-row payload, normalization, and success entries remain available in All Logs.
        </div>
      )}

      {/* Controls */}
      <div className="debug-controls">
        <button className="btn btn-primary" onClick={handleRefresh}>Refresh</button>
        <button className="btn btn-secondary" onClick={handleClear}>Clear</button>
        <button className="btn btn-secondary" onClick={expandAll}>Expand All</button>
        <button className="btn btn-secondary" onClick={collapseAll}>Collapse All</button>

        <select
          className="debug-select"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value as LogLevel | 'ALL')}
        >
          <option value="ALL">All Levels</option>
          {ALL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>

        {showModule && (
          <select
            className="debug-select"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            <option value="ALL">All Modules</option>
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}

        <input
          className="debug-search"
          type="text"
          placeholder="Search logs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <span className="debug-count">{filtered.length} / {baseLogs.length}</span>
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
                {showModule && <th style={{ width: 100 }}>Module</th>}
                <th style={{ width: 100 }}>Step</th>
                <th>Message</th>
                <th style={{ width: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const globalIdx = baseLogs.indexOf(entry);
                const isExpanded = expandedRows.has(globalIdx);
                const hasPayload = entry.payload !== undefined;
                return (
                  <tr key={globalIdx} onClick={() => hasPayload && toggleRow(globalIdx)} style={{ cursor: hasPayload ? 'pointer' : 'default' }}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{entry.timestamp}</td>
                    <td style={{ color: LEVEL_COLORS[entry.level] ?? '#444', fontWeight: 600, fontSize: '0.75rem' }}>{entry.level}</td>
                    {showModule && <td style={{ fontSize: '0.78rem' }}>{entry.module}</td>}
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
