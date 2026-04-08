import { useState, useEffect } from 'react';
import {
  fetchSources,
  resolveSourceId,
  loadSourcesCache,
  loadSourceDefaults,
  saveSourceDefaults,
  DEFAULT_PAST_SOURCE_NAME,
  DEFAULT_FUTURE_SOURCE_NAME,
  type CloudbedsSource,
} from '../../services/sourceConfigurationService';
import { loadApiConfig } from '../../services/apiConfigurationService';
import { debug, info, warn, error as logError } from '../../services/debugLogger';
import './pages.css';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

function SourceConfiguration() {
  const [oldSourceName, setOldSourceName] = useState(DEFAULT_PAST_SOURCE_NAME);
  const [oldSourceId, setOldSourceId] = useState('');
  const [futureSourceName, setFutureSourceName] = useState(DEFAULT_FUTURE_SOURCE_NAME);
  const [futureSourceId, setFutureSourceId] = useState('');

  // Persist default source names so the migration flow can read them.
  const persistDefaults = (pastName: string, futureName: string) => {
    const config = loadApiConfig();
    if (!config) return;
    saveSourceDefaults(config.propertyId, {
      pastSourceName: pastName,
      futureSourceName: futureName,
    });
  };
  const [allSources, setAllSources] = useState<CloudbedsSource[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const getSafeSourceRows = (value: unknown, stage: string): CloudbedsSource[] => {
    if (Array.isArray(value)) {
      return value as CloudbedsSource[];
    }

    logError('SourceConfig', 'render', 'Source rows are not an array', {
      stage,
      valueType: typeof value,
      fallbackUsed: true,
      payloadSample: value,
    });
    return [];
  };

  const resolveAndLog = (sources: CloudbedsSource[], name: string, label: string): string => {
    const safeSources = getSafeSourceRows(sources, `resolution:${label}`);
    debug('SourceConfig', 'resolution', `Looking up ${label}: "${name}"`, {
      lookupTarget: name,
      availableSourceNamesSample: safeSources.slice(0, 10).map((s) => s.sourceName),
      totalSources: safeSources.length,
    });
    const id = resolveSourceId(safeSources, name);
    const matchedRow = safeSources.find((source) => source.sourceID === id);
    if (id) {
      info('SourceConfig', 'resolution', `Resolved ${name} → ${id}`, {
        sourceName: name,
        sourceID: id,
        matchedSourceRow: matchedRow,
      });
    } else {
      warn('SourceConfig', 'resolution', `No match for ${label}: "${name}"`, {
        searched: name,
        availableCount: safeSources.length,
      });
    }
    return id;
  };

  // Load cached sources on mount
  useEffect(() => {
    const config = loadApiConfig();
    if (!config) return;

    // Load persisted default source names (or fall back to constants)
    const persistedDefaults = loadSourceDefaults(config.propertyId);
    setOldSourceName(persistedDefaults.pastSourceName);
    setFutureSourceName(persistedDefaults.futureSourceName);

    const cached = loadSourcesCache(config.propertyId);
    if (cached && cached.length > 0) {
      debug('SourceConfig', 'cache', `Loaded ${cached.length} sources from cache`, {
        first3: cached.slice(0, 3).map((s) => ({ sourceID: s.sourceID, sourceName: s.sourceName })),
      });
      const cachedRows = getSafeSourceRows(cached, 'cache-load');
      setAllSources(cachedRows);
      setOldSourceId(resolveAndLog(cachedRows, persistedDefaults.pastSourceName, 'Old Reservations'));
      setFutureSourceId(resolveAndLog(cachedRows, persistedDefaults.futureSourceName, 'Future Reservations'));
      setLoadStatus('success');
      setStatusMessage(`Loaded ${cachedRows.length} sources from cache.`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const safeRows = Array.isArray(allSources) ? allSources : [];
    debug('SourceConfig', 'state-render', 'Source state updated', {
      sourceStateCount: safeRows.length,
      renderGuardFallbackUsed: !Array.isArray(allSources),
    });
  }, [allSources]);

  const handleGetSources = async () => {
    setLoadStatus('loading');
    setStatusMessage('Fetching sources...');

    const result = await fetchSources();

    if (!result.success) {
      setLoadStatus('error');
      setStatusMessage(result.message);
      return;
    }

    const parsedRows = getSafeSourceRows(result.sources, 'fetch-success');

    // --- State binding stage ---
    debug('SourceConfig', 'state-bind', 'Setting source state', {
      parsedRowCount: parsedRows.length,
      first3: parsedRows.slice(0, 3).map((s) => ({ sourceID: s.sourceID, sourceName: s.sourceName })),
    });

    setAllSources(parsedRows);
    const oldId = resolveAndLog(parsedRows, oldSourceName, 'Old Reservations');
    const futureId = resolveAndLog(parsedRows, futureSourceName, 'Future Reservations');
    setOldSourceId(oldId);
    setFutureSourceId(futureId);
    persistDefaults(oldSourceName, futureSourceName);
    setLoadStatus('success');
    setStatusMessage(result.message);

    debug('SourceConfig', 'state-bind', 'State set complete', {
      parsedRowCount: parsedRows.length,
      sourceStateCount: parsedRows.length,
      oldSourceId: oldId,
      futureSourceId: futureId,
    });
  };

  // --- Render-side logging ---
  const renderRows = Array.isArray(allSources) ? allSources : null;
  const renderGuardFallbackUsed = renderRows === null;
  const sourceRows = renderRows ?? [];

  debug('SourceConfig', 'render', 'Render inspection', {
    sourceStateCount: Array.isArray(allSources) ? allSources.length : 'invalid',
    renderedRowCount: sourceRows.length,
    renderGuardFallbackUsed,
  });

  if (renderGuardFallbackUsed) {
    logError('SourceConfig', 'render', 'Render guard fallback used', {
      sourceStateType: typeof allSources,
      payloadSample: allSources,
    });
  } else if (loadStatus === 'success' && sourceRows.length === 0) {
    debug('SourceConfig', 'render', 'Table rendering empty', { reason: 'sourceRows is empty after success' });
  }

  return (
    <div className="config-page">
      <h3>Source Configuration</h3>

      <div className="config-note config-note--compact">
        <strong>For old reservations:</strong> Go to Settings &rarr; Property &rarr;
        Sources &rarr; Add Primary Source. Create a source named{' '}
        <strong>FORMERPMS</strong>. Ensure all tax settings are correctly configured.
        <br />
        <strong>For future reservations:</strong> Use the same menu. Decide the
        appropriate source for new reservations. This field remains visible for
        later use, but it is currently inactive in reservation migration.
      </div>

      <div className="config-section config-section--compact">
        <h4>Old Reservations</h4>
        <div className="config-row config-row--tight">
          <div className="config-field">
            <label>Source Name</label>
            <input
              type="text"
              value={oldSourceName}
              onChange={(e) => {
                const next = e.target.value;
                setOldSourceName(next);
                persistDefaults(next, futureSourceName);
              }}
            />
          </div>
          <div className="config-field">
            <label>Source ID</label>
            <input type="text" readOnly value={oldSourceId} placeholder="—" />
          </div>
        </div>
      </div>

      <div className="config-section config-section--compact">
        <h4>Future Reservations</h4>
        <div className="config-row config-row--tight">
          <div className="config-field">
            <label>Source Name</label>
            <input
              type="text"
              value={futureSourceName}
              disabled
              readOnly
            />
          </div>
          <div className="config-field">
            <label>Source ID</label>
            <input type="text" readOnly disabled value={futureSourceId} placeholder="—" />
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleGetSources}
        disabled={loadStatus === 'loading'}
      >
        {loadStatus === 'loading' ? 'Fetching...' : 'Get Sources'}
      </button>

      {statusMessage && (
        <div
          className={`status-area status-area--${loadStatus === 'loading' ? 'idle' : loadStatus}`}
          style={{ marginTop: 8 }}
        >
          {statusMessage}
        </div>
      )}

      {loadStatus === 'success' && sourceRows.length === 0 && (
        <div className="status-area status-area--idle" style={{ marginTop: 12 }}>
          No sources returned. Check that the property has sources configured in Cloudbeds.
        </div>
      )}

      {renderGuardFallbackUsed && (
        <div className="status-area status-area--error" style={{ marginTop: 12 }}>
          Source table could not be rendered safely. Check the Debug Tool for SourceConfig error details.
        </div>
      )}

      {sourceRows.length > 0 && (
        <div className="scrollable-list" style={{ marginTop: 12 }}>
          <table className="compact-table">
            <thead>
              <tr>
                <th>Source Name</th>
                <th>Source ID</th>
                <th>Third Party</th>
                <th>Status</th>
                <th>Payment Collect</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(sourceRows) ? sourceRows.map((s) => (
                <tr key={s.sourceID ?? Math.random()}>
                  <td>{String(s.sourceName ?? '')}</td>
                  <td>{String(s.sourceID ?? '')}</td>
                  <td>{s.isThirdParty ? 'Yes' : 'No'}</td>
                  <td>{String(s.status ?? '')}</td>
                  <td>{String(s.paymentCollect ?? '')}</td>
                </tr>
              )) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SourceConfiguration;
