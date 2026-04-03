import { useState, useEffect } from 'react';
import {
  fetchRates,
  resolveRatePlanId,
  loadRatesCache,
  type CloudbedsRateEntry,
} from '../../services/rateConfigurationService';
import { loadApiConfig } from '../../services/apiConfigurationService';
import './pages.css';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

function RateConfiguration() {
  const [oldRateName, setOldRateName] = useState('FORMERPMS');
  const [oldRatePlanId, setOldRatePlanId] = useState('');
  const [futureRateName, setFutureRateName] = useState('Walkin');
  const [futureRatePlanId, setFutureRatePlanId] = useState('');
  const [allRates, setAllRates] = useState<CloudbedsRateEntry[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  // Load cached rates on mount
  useEffect(() => {
    const config = loadApiConfig();
    if (!config) return;
    const cached = loadRatesCache(config.propertyId);
    if (cached) {
      setAllRates(cached);
      setOldRatePlanId(resolveRatePlanId(cached, oldRateName));
      setFutureRatePlanId(resolveRatePlanId(cached, futureRateName));
      setLoadStatus('success');
      setStatusMessage(`Loaded ${cached.length} rate entries from cache.`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGetRates = async () => {
    setLoadStatus('loading');
    setStatusMessage('Fetching rates...');

    const result = await fetchRates();

    if (!result.success) {
      setLoadStatus('error');
      setStatusMessage(result.message);
      return;
    }

    setAllRates(result.rates);
    setOldRatePlanId(resolveRatePlanId(result.rates, oldRateName));
    setFutureRatePlanId(resolveRatePlanId(result.rates, futureRateName));
    setLoadStatus('success');
    setStatusMessage(result.message);
  };

  return (
    <div className="config-page">
      <h3>Rate Configuration</h3>

      <div className="config-note config-note--compact">
        Go to the Cloudbeds area where rate plans are managed. Identify the public
        rate code/name for old and future reservations. Enter the exact public rate
        value as configured in Cloudbeds.<br />
        <strong>Note:</strong> A single rate plan can have different <em>rateID</em>{' '}
        values per room type. Final resolution uses <em>ratePlanNamePublic</em> +{' '}
        <em>roomTypeID</em> to find the correct <em>rateID</em> for each reservation.
      </div>

      <div className="config-section config-section--compact">
        <h4>Old Reservations</h4>
        <div className="config-row config-row--tight">
          <div className="config-field">
            <label>Rate Plan Public Name</label>
            <input
              type="text"
              value={oldRateName}
              onChange={(e) => setOldRateName(e.target.value)}
            />
          </div>
          <div className="config-field">
            <label>Rate Plan ID</label>
            <input
              type="text"
              readOnly
              value={oldRatePlanId}
              placeholder="—"
            />
          </div>
        </div>
      </div>

      <div className="config-section config-section--compact">
        <h4>Future Reservations</h4>
        <div className="config-row config-row--tight">
          <div className="config-field">
            <label>Rate Plan Public Name</label>
            <input
              type="text"
              value={futureRateName}
              onChange={(e) => setFutureRateName(e.target.value)}
            />
          </div>
          <div className="config-field">
            <label>Rate Plan ID</label>
            <input
              type="text"
              readOnly
              value={futureRatePlanId}
              placeholder="—"
            />
          </div>
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleGetRates}
        disabled={loadStatus === 'loading'}
      >
        {loadStatus === 'loading' ? 'Fetching...' : 'Get Rates'}
      </button>

      {statusMessage && (
        <div
          className={`status-area status-area--${loadStatus === 'loading' ? 'idle' : loadStatus}`}
          style={{ marginTop: 8 }}
        >
          {statusMessage}
        </div>
      )}

      {allRates.length > 0 && (
        <div className="scrollable-list" style={{ marginTop: 12 }}>
          <table className="compact-table">
            <thead>
              <tr>
                <th>Rate Plan Public Name</th>
                <th>Rate Plan ID</th>
                <th>Room Type Name</th>
                <th>Room Type ID</th>
                <th>Rate ID</th>
              </tr>
            </thead>
            <tbody>
              {allRates.map((r, i) => (
                <tr key={`${r.ratePlanID}-${r.roomTypeID}-${r.rateID}-${i}`}>
                  <td>{r.ratePlanNamePublic}</td>
                  <td>{r.ratePlanID}</td>
                  <td>{r.roomTypeName}</td>
                  <td>{r.roomTypeID}</td>
                  <td>{r.rateID}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default RateConfiguration;
