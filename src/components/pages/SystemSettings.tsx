import { useMemo, useState } from 'react';
import {
  formatAppDateTimeForInput,
  getConfiguredManualDateTime,
  getCurrentAppDateTime,
  isUsingSystemDateTime,
  loadAppDateTimeSettings,
  saveAppDateTimeSettings,
} from '../../services/appDateTimeService';
import { info } from '../../services/debugLogger';
import './pages.css';

function SystemSettings() {
  const initialSettings = useMemo(() => loadAppDateTimeSettings(), []);
  const [useSystemDateTime, setUseSystemDateTime] = useState(isUsingSystemDateTime());
  const [manualDateTime, setManualDateTime] = useState(
    getConfiguredManualDateTime() ?? formatAppDateTimeForInput(getCurrentAppDateTime()),
  );

  const currentPreview = useMemo(() => {
    const previewDate = useSystemDateTime
      ? new Date()
      : (manualDateTime ? new Date(manualDateTime) : getCurrentAppDateTime());
    return isNaN(previewDate.getTime()) ? 'Invalid manual date/time' : previewDate.toLocaleString('en-GB', {
      timeZone: initialSettings.timezone,
      hour12: false,
    });
  }, [initialSettings.timezone, manualDateTime, useSystemDateTime]);

  const persist = (nextUseSystemDateTime: boolean, nextManualDateTime: string) => {
    saveAppDateTimeSettings({
      useSystemDateTime: nextUseSystemDateTime,
      manualDateTime: nextManualDateTime || null,
      timezone: 'Europe/Istanbul',
    });
  };

  return (
    <div className="config-page">
      <h3>System Settings</h3>

      <div className="config-section config-section--compact">
        <h4>App Date / Time</h4>
        <div className="config-row config-row--tight">
          <div className="config-field">
            <label>Date / Time</label>
            <input
              type="datetime-local"
              value={manualDateTime}
              disabled={useSystemDateTime}
              onChange={(e) => {
                const next = e.target.value;
                setManualDateTime(next);
                persist(useSystemDateTime, next);
                info('SystemSettings', 'manual-datetime', 'Manual app date/time updated', {
                  manualDateTime: next,
                  useSystemDateTime,
                });
              }}
            />
          </div>
          <div className="config-field">
            <label>Timezone</label>
            <input type="text" readOnly value="Europe/Istanbul" />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <input
            type="checkbox"
            checked={useSystemDateTime}
            onChange={(e) => {
              const next = e.target.checked;
              setUseSystemDateTime(next);
              persist(next, manualDateTime);
              info('SystemSettings', 'mode', next ? 'Using PC system date/time' : 'Using manually configured app date/time', {
                useSystemDateTime: next,
                manualDateTime,
              });
            }}
          />
          Use System Settings
        </label>

        <div className="config-note config-note--compact" style={{ marginTop: 12 }}>
          Current app date/time preview: <strong>{currentPreview}</strong>
        </div>
      </div>
    </div>
  );
}

export default SystemSettings;
