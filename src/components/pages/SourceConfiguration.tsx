import { useState, useEffect } from 'react';
import {
  fetchSources,
  resolveSourceId,
  loadSourcesCache,
  type CloudbedsSource,
} from '../../services/sourceConfigurationService';
import { loadApiConfig } from '../../services/apiConfigurationService';
import { debug, info, warn } from '../../services/debugLogger';
import './pages.css';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

function SourceConfiguration() {
  const [oldSourceName, setOldSourceName] = useState('FORMERPMS');
  const [oldSourceId, setOldSourceId] = useState('');
  const [futureSourceName, setFutureSourceName] = useState('Direct - Hotel');
  const [futureSourceId, setFutureSourceId] = useState('');
  const [allSources, setAllSources] = useState<CloudbedsSource[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const resolveAndLog = (sources: CloudbedsSource[], name: string, label: string): string => {
    debug('SourceConfig', 'resolution', `Looking up ${label}: "${name}"`, {
      availableNames: sources.slice(0, 10).map((s) => s.sourceName),
      totalSources: sources.length,
    });
    const id = resolveSourceId(sources, name);
    if (id) {
      info('SourceConfig', 'resolution', `Resolved ${name} → ${id}`, { sourceName: name, sourceID: id });
    } else {
      warn('SourceConfig', 'resolution', `No match for ${label}: "${name}"`, {
        searched: name,
        availableCount: sources.length,
      });
    }
    return id;
  };

  // Load cached sources on mount
  useEffect(() => {
    const config = loadApiConfig();
    if (!config) return;
    const cached = loadSourcesCache(config.propertyId);
    if (cached && cached.length > 0) {
      debug('SourceConfig', 'cache', `Loaded ${cached.length} sources from cache`, {
        first3: cached.slice(0, 3).map((s) => ({ sourceID: s.sourceID, sourceName: s.sourceName })),
      });
      setAllSources(cached);
      setOldSourceId(resolveSourceId(cached, 'FORMERPMS'));
      setFutureSourceId(resolveSourceId(cached, 'Direct - Hotel'));
      setLoadStatus('success');
      setStatusMessage(`Loaded ${cached.length} sources from cache.`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGetSources = async () => {
    setLoadStatus('loading');
    setStatusMessage('Fetching sources...');

    const result = await fetchSources();

    if (!result.success) {
      setLoadStatus('error');
      setStatusMessage(result.message);
      return;
    }

    // --- State binding stage ---
    debug('SourceConfig', 'state-bind', 'Setting source state', {
      parsedCount: result.sources.length,
      first3: result.sources.slice(0, 3).map((s) => ({ sourceID: s.sourceID, sourceName: s.sourceName })),
    });

    setAllSources(result.sources);
    const oldId = resolveAndLog(result.sources, oldSourceName, 'Old Reservations');
    const futureId = resolveAndLog(result.sources, futureSourceName, 'Future Reservations');
    setOldSourceId(oldId);
    setFutureSourceId(futureId);
    setLoadStatus('success');
    setStatusMessage(result.message);

    debug('SourceConfig', 'state-bind', 'State set complete', {
      sourceCount: result.sources.length,
      oldSourceId: oldId,
      futureSourceId: futureId,
    });
  };

  // --- Render-side logging ---
  const sourceRows = Array.isArray(allSources) ? allSources : [];
  if (loadStatus === 'success' && sourceRows.length === 0) {
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
        appropriate source for new reservations.
      </div>

      <div className="config-section config-section--compact">
        <h4>Old Reservations</h4>
        <div className="config-row config-row--tight">
          <div className="config-field">
            <label>Source Name</label>
            <input
              type="text"
              value={oldSourceName}
              onChange={(e) => setOldSourceName(e.target.value)}
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
              onChange={(e) => setFutureSourceName(e.target.value)}
            />
          </div>
          <div className="config-field">
            <label>Source ID</label>
            <input type="text" readOnly value={futureSourceId} placeholder="—" />
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
              {sourceRows.map((s) => (
                <tr key={s.sourceID}>
                  <td>{s.sourceName}</td>
                  <td>{s.sourceID}</td>
                  <td>{s.isThirdParty ? 'Yes' : 'No'}</td>
                  <td>{s.status}</td>
                  <td>{s.paymentCollect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SourceConfiguration;
