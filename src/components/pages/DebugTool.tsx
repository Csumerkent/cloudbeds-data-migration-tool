import { useEffect, useMemo, useState } from 'react';
import { getLogs, clearLogs, getModules, type LogEntry, type LogLevel } from '../../services/debugLogger';
import type { NavigationFilters } from '../../types/navigation';
import './pages.css';

const LEVEL_COLORS: Record<string, string> = {
  DEBUG: '#6a1b9a',
  INFO: '#2e7d32',
  WARN: '#f57c00',
  ERROR: '#c62828',
};

const ALL_LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
const NOISY_MIGRATION_KINDS = new Set(['payload', 'api_response', 'row_success', 'normalization']);

type DebugTab = 'all' | 'migration';

interface DebugToolProps {
  navigationFilters: NavigationFilters;
}

function isMigrationEntry(entry: LogEntry): boolean {
  return entry.module === 'Migration'
    || entry.module === 'ExcelValidation'
    || entry.meta?.logKind === 'migration'
    || entry.meta?.logKind === 'validation'
    || entry.meta?.logKind === 'invalid_row'
    || entry.meta?.logKind === 'execution_summary';
}

function matchesNavigationFilters(entry: LogEntry, filters: NavigationFilters, activeTab: DebugTab): boolean {
  if (filters.moduleScope) {
    const moduleMatch = entry.meta?.moduleScope === filters.moduleScope || entry.module === filters.moduleScope;
    if (!moduleMatch) return false;
  }

  if (filters.fileName && entry.meta?.fileName !== filters.fileName) {
    return false;
  }

  if (filters.jobId && entry.meta?.jobId !== filters.jobId) {
    return false;
  }

  if (filters.chunkId && entry.meta?.chunkId !== filters.chunkId) {
    return false;
  }

  if (filters.invalidRowsOnly) {
    const invalidMatch = entry.meta?.logKind === 'invalid_row'
      || (typeof entry.meta?.rowNumber === 'number' && entry.level !== 'INFO');
    if (!invalidMatch) return false;
  }

  if (activeTab === 'migration' && entry.meta?.moduleScope === 'Reservation' && NOISY_MIGRATION_KINDS.has(entry.meta?.logKind ?? '')) {
    return false;
  }

  return true;
}

function DebugTool({ navigationFilters }: DebugToolProps) {
  const [logs, setLogs] = useState<LogEntry[]>(() => [...getLogs()]);
  const [activeTab, setActiveTab] = useState<DebugTab>(navigationFilters.migrationLogsOnly ? 'migration' : 'all');
  const [levelFilter, setLevelFilter] = useState<LogLevel | 'ALL'>('ALL');
  const [moduleFilter, setModuleFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    setActiveTab(navigationFilters.migrationLogsOnly ? 'migration' : 'all');
  }, [navigationFilters.migrationLogsOnly]);

  const migrationLogs = useMemo(() => {
    return [...logs].filter(isMigrationEntry).reverse();
  }, [logs]);

  const baseLogs = activeTab === 'migration' ? migrationLogs : logs;

  const modules = useMemo(() => {
    const m = getModules();
    const fromLogs = [...new Set(logs.map((l) => l.module))];
    return [...new Set([...m, ...fromLogs])].sort();
  }, [logs]);

  const filtered = useMemo(() => {
    let result = baseLogs.filter((entry) => matchesNavigationFilters(entry, navigationFilters, activeTab));
    if (levelFilter !== 'ALL') {
      result = result.filter((l) => l.level === levelFilter);
    }
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
          JSON.stringify(l.meta ?? {}).toLowerCase().includes(lower) ||
          (l.payload && JSON.stringify(l.payload).toLowerCase().includes(lower)),
      );
    }
    return result;
  }, [activeTab, baseLogs, levelFilter, moduleFilter, navigationFilters, search]);

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
    if (tab === 'migration') {
      setModuleFilter('ALL');
    }
  };

  const migrationCount = migrationLogs.length;
  const showModule = activeTab === 'all';
  const hasFocusedNavigation = !!(
    navigationFilters.moduleScope
    || navigationFilters.fileName
    || navigationFilters.jobId
    || navigationFilters.invalidRowsOnly
    || navigationFilters.migrationLogsOnly
  );

  return (
    <div className="config-page" style={{ maxWidth: 1100 }}>
      <h3>Debug Tool</h3>

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

      {hasFocusedNavigation ? (
        <div className="config-note config-note--compact">
          Filtered view: {navigationFilters.moduleScope ?? 'All modules'}
          {navigationFilters.fileName ? ` / ${navigationFilters.fileName}` : ''}
          {navigationFilters.invalidRowsOnly ? ' / invalid rows only' : ''}
          {navigationFilters.migrationLogsOnly ? ' / migration logs only' : ''}
        </div>
      ) : null}

      {activeTab === 'all' && (
        <div className="config-note config-note--compact">
          Session-based debug log. Entries are in memory only and reset on app close.
        </div>
      )}

      {activeTab === 'migration' && (
        <div className="config-note config-note--compact">
          Migration logs focus on validation summaries, invalid rows, batch progress, execution stops, errors, and final summaries.
        </div>
      )}

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
                      {entry.meta?.rowNumber ? (
                        <span className="debug-payload-hint"> [row {entry.meta.rowNumber}]</span>
                      ) : null}
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
