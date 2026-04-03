import { useState, useEffect } from 'react';
import {
  fetchSources,
  resolveSourceId,
  loadSourcesCache,
  type CloudbedsSource,
} from '../../services/sourceConfigurationService';
import { loadApiConfig } from '../../services/apiConfigurationService';
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

  // Load cached sources on mount
  useEffect(() => {
    const config = loadApiConfig();
    if (!config) return;
    const cached = loadSourcesCache(config.propertyId);
    if (cached) {
      setAllSources(cached);
      setOldSourceId(resolveSourceId(cached, oldSourceName));
      setFutureSourceId(resolveSourceId(cached, futureSourceName));
      setLoadStatus('success');
      setStatusMessage(`Loaded ${cached.length} sources from cache.`);
    }
  // Only run on mount
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

    setAllSources(result.sources);
    setOldSourceId(resolveSourceId(result.sources, oldSourceName));
    setFutureSourceId(resolveSourceId(result.sources, futureSourceName));
    setLoadStatus('success');
    setStatusMessage(result.message);
  };

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
            <input
              type="text"
              readOnly
              value={oldSourceId}
              placeholder="—"
            />
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
            <input
              type="text"
              readOnly
              value={futureSourceId}
              placeholder="—"
            />
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

      {allSources.length > 0 && (
        <div className="scrollable-list" style={{ marginTop: 12 }}>
          <table className="compact-table">
            <thead>
              <tr>
                <th>Source Name</th>
                <th>Source ID</th>
              </tr>
            </thead>
            <tbody>
              {allSources.map((s) => (
                <tr key={s.sourceID}>
                  <td>{s.sourceName}</td>
                  <td>{s.sourceID}</td>
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
