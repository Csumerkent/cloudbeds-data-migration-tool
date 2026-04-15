import { useState, useEffect } from 'react';
import {
  fetchRates,
  resolveRatePlanId,
  loadRatesCache,
  isValidDate,
  loadRateDefaults,
  saveRateDefaults,
  DEFAULT_PAST_RATE_NAME,
  DEFAULT_FUTURE_RATE_NAME,
  type CloudbedsRateEntry,
} from '../../services/rateConfigurationService';
import { loadApiConfig } from '../../services/apiConfigurationService';
import { debug, info, warn } from '../../services/debugLogger';
import './pages.css';

type LoadStatus = 'idle' | 'loading' | 'success' | 'error';

function RateConfiguration() {
  const [oldRateName, setOldRateName] = useState(DEFAULT_PAST_RATE_NAME);
  const [oldRatePlanId, setOldRatePlanId] = useState('');
  const [futureRateName, setFutureRateName] = useState(DEFAULT_FUTURE_RATE_NAME);
  const [futureRatePlanId, setFutureRatePlanId] = useState('');
  const [allRates, setAllRates] = useState<CloudbedsRateEntry[]>([]);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [startDate, setStartDate] = useState('2021-01-01');
  const [endDate, setEndDate] = useState('2027-01-01');

  // Persist default rate plan names so the migration flow can read them.
  const persistDefaults = (pastName: string, futureName: string) => {
    const config = loadApiConfig();
    if (!config) return;
    saveRateDefaults(config.propertyId, {
      pastRateName: pastName,
      futureRateName: futureName,
    });
  };

  const resolveAndLog = (rates: CloudbedsRateEntry[], name: string, label: string): string => {
    const uniqueNames = [...new Set(rates.map((r) => r.ratePlanNamePublic))];
    debug('RateConfig', 'resolution', `Looking up ${label}: "${name}"`, {
      uniqueRatePlanNames: uniqueNames.slice(0, 15),
      totalRateRows: rates.length,
    });
    const id = resolveRatePlanId(rates, name);
    if (id) {
      const matchedRows = rates.filter((r) => r.ratePlanID === id);
      info('RateConfig', 'resolution', `Resolved ${name} → ${id}`, {
        ratePlanNamePublic: name,
        ratePlanID: id,
        matchedRoomTypes: matchedRows.map((r) => ({ roomTypeName: r.roomTypeName, roomTypeID: r.roomTypeID, rateID: r.rateID })),
      });
    } else {
      warn('RateConfig', 'resolution', `No match for ${label}: "${name}"`, {
        searched: name,
        availableNames: uniqueNames,
      });
    }
    return id;
  };

  // Load cached rates on mount
  useEffect(() => {
    const config = loadApiConfig();
    if (!config) return;

    // Load persisted default rate plan names (or fall back to constants)
    const persistedDefaults = loadRateDefaults(config.propertyId);
    setOldRateName(persistedDefaults.pastRateName);
    setFutureRateName(persistedDefaults.futureRateName);

    const cached = loadRatesCache(config.propertyId);
    if (cached && cached.length > 0) {
      debug('RateConfig', 'cache', `Loaded ${cached.length} rate entries from cache`, {
        first5: cached.slice(0, 5).map((r) => ({ ratePlanNamePublic: r.ratePlanNamePublic, ratePlanID: r.ratePlanID, roomTypeID: r.roomTypeID, rateID: r.rateID })),
      });
      setAllRates(cached);
      setOldRatePlanId(resolveRatePlanId(cached, persistedDefaults.pastRateName));
      setFutureRatePlanId(resolveRatePlanId(cached, persistedDefaults.futureRateName));
      setLoadStatus('success');
      setStatusMessage(`Loaded ${cached.length} rate entries from cache.`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGetRates = async () => {
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      setLoadStatus('error');
      setStatusMessage('Invalid date format. Use YYYY-MM-DD.');
      return;
    }

    setLoadStatus('loading');
    setStatusMessage('Fetching rates...');

    const result = await fetchRates(startDate, endDate);

    if (!result.success) {
      setLoadStatus('error');
      setStatusMessage(result.message);
      return;
    }

    // --- State binding stage ---
    debug('RateConfig', 'state-bind', 'Setting rate state', {
      parsedCount: result.rates.length,
      first5: result.rates.slice(0, 5).map((r) => ({ ratePlanNamePublic: r.ratePlanNamePublic, ratePlanID: r.ratePlanID, rateID: r.rateID })),
    });

    setAllRates(result.rates);
    const oldId = resolveAndLog(result.rates, oldRateName, 'Old Reservations');
    const futureId = resolveAndLog(result.rates, futureRateName, 'Future Reservations');
    setOldRatePlanId(oldId);
    setFutureRatePlanId(futureId);
    persistDefaults(oldRateName, futureRateName);
    setLoadStatus('success');
    setStatusMessage(result.message);

    debug('RateConfig', 'state-bind', 'State set complete', {
      rateCount: result.rates.length,
      oldRatePlanId: oldId,
      futureRatePlanId: futureId,
    });
  };

  // --- Render-side logging ---
  const rateRows = Array.isArray(allRates) ? allRates : [];
  if (loadStatus === 'success' && rateRows.length === 0) {
    debug('RateConfig', 'render', 'Table rendering empty', { reason: 'rateRows is empty after success' });
  }

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

      <div className="config-row config-row--tight" style={{ marginTop: 8 }}>
        <div className="config-field">
          <label>Start Date</label>
          <input
            type="text"
            value={startDate}
            placeholder="YYYY-MM-DD"
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="config-field">
          <label>End Date</label>
          <input
            type="text"
            value={endDate}
            placeholder="YYYY-MM-DD"
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={handleGetRates}
        disabled={loadStatus === 'loading'}
        style={{ marginTop: 8 }}
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

      <div className="config-section config-section--compact">
        <h4>Old Reservations</h4>
        <div className="config-row config-row--tight">
          <div className="config-field">
            <label>Rate Plan Public Name</label>
            <input
              type="text"
              value={oldRateName}
              onChange={(e) => {
                const next = e.target.value;
                setOldRateName(next);
                persistDefaults(next, futureRateName);
              }}
            />
          </div>
          <div className="config-field">
            <label>Rate Plan ID</label>
            <input type="text" readOnly value={oldRatePlanId} placeholder="—" />
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
              onChange={(e) => {
                const next = e.target.value;
                setFutureRateName(next);
                persistDefaults(oldRateName, next);
              }}
            />
          </div>
          <div className="config-field">
            <label>Rate Plan ID</label>
            <input type="text" readOnly value={futureRatePlanId} placeholder="—" />
          </div>
        </div>
      </div>

      {rateRows.length > 0 && (
        <div className="scrollable-list" style={{ marginTop: 12 }}>
          <table className="compact-table">
            <thead>
              <tr>
                <th>Rate Plan Public Name</th>
                <th>Rate Plan ID</th>
                <th>Room Type Name</th>
                <th>Room Type ID</th>
                <th>Rate ID</th>
                <th>Derived</th>
              </tr>
            </thead>
            <tbody>
              {rateRows.map((r, i) => (
                <tr key={`${r.ratePlanID}-${r.roomTypeID}-${r.rateID}-${i}`}>
                  <td>{r.ratePlanNamePublic}</td>
                  <td>{r.ratePlanID}</td>
                  <td>{r.roomTypeName}</td>
                  <td>{r.roomTypeID}</td>
                  <td>{r.rateID}</td>
                  <td>{r.isDerived ? 'Yes' : 'No'}</td>
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
