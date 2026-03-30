import { useState, useEffect } from 'react';
import {
  testMainConnection,
  testOtherUrl,
  saveApiConfig,
  loadApiConfig,
  DEFAULT_OTHER_URLS,
  DEFAULT_MAIN_API_URL,
  type UrlSlotStatus,
} from '../../services/apiConfigurationService';
import './pages.css';

type MainStatus = 'idle' | 'loading' | 'success' | 'error';

function ApiConfiguration() {
  const [apiKey, setApiKey] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [mainApiUrl, setMainApiUrl] = useState(DEFAULT_MAIN_API_URL);
  const [otherUrls, setOtherUrls] = useState<string[]>(DEFAULT_OTHER_URLS);

  const [mainStatus, setMainStatus] = useState<MainStatus>('idle');
  const [mainMessage, setMainMessage] = useState('Not tested yet.');
  const [otherStatuses, setOtherStatuses] = useState<UrlSlotStatus[]>(
    Array(10).fill('idle'),
  );
  const [otherMessages, setOtherMessages] = useState<string[]>(
    Array(10).fill(''),
  );
  const [showSavePrompt, setShowSavePrompt] = useState(false);

  // Load persisted config on mount
  useEffect(() => {
    const saved = loadApiConfig();
    if (saved) {
      setApiKey(saved.apiKey);
      setPropertyId(saved.propertyId);
      setMainApiUrl(saved.mainApiUrl);
      setOtherUrls(saved.otherUrls);
    }
  }, []);

  const updateOtherUrl = (index: number, value: string) => {
    setOtherUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
    // Reset status for changed URL
    setOtherStatuses((prev) => prev.map((s, i) => (i === index ? 'idle' : s)));
    setOtherMessages((prev) => prev.map((m, i) => (i === index ? '' : m)));
  };

  const handleTestConnection = async () => {
    setShowSavePrompt(false);

    // --- Test Main API ---
    setMainStatus('loading');
    setMainMessage('Testing connection...');

    const mainResult = await testMainConnection({ mainApiUrl, apiKey, propertyId });
    setMainStatus(mainResult.success ? 'success' : 'error');
    setMainMessage(mainResult.message);

    // --- Test Other URLs in parallel ---
    const newStatuses = [...otherStatuses];
    const newMessages = [...otherMessages];

    // Mark non-empty slots as testing
    otherUrls.forEach((url, i) => {
      if (url.trim()) {
        newStatuses[i] = 'testing';
        newMessages[i] = 'Testing...';
      } else {
        newStatuses[i] = 'idle';
        newMessages[i] = '';
      }
    });
    setOtherStatuses([...newStatuses]);
    setOtherMessages([...newMessages]);

    const promises = otherUrls.map(async (url, i) => {
      if (!url.trim()) return;
      const result = await testOtherUrl(i, url, apiKey);
      newStatuses[i] = result.reachable ? 'success' : 'failed';
      newMessages[i] = result.message;
    });

    await Promise.all(promises);
    setOtherStatuses([...newStatuses]);
    setOtherMessages([...newMessages]);

    // Show save prompt if main succeeded
    if (mainResult.success) {
      setShowSavePrompt(true);
    }
  };

  const handleSave = () => {
    saveApiConfig({ apiKey, propertyId, mainApiUrl, otherUrls });
    setShowSavePrompt(false);
    setMainMessage('Connection successful. Configuration saved.');
  };

  const handleDismissSave = () => {
    setShowSavePrompt(false);
  };

  const statusIndicator = (slotStatus: UrlSlotStatus, message: string) => {
    const cls =
      slotStatus === 'success'
        ? 'url-status url-status--success'
        : slotStatus === 'failed'
          ? 'url-status url-status--failed'
          : slotStatus === 'testing'
            ? 'url-status url-status--testing'
            : 'url-status url-status--idle';
    return <span className={cls}>{message || (slotStatus === 'idle' ? '' : slotStatus)}</span>;
  };

  return (
    <div className="config-page">
      <h3>API Configuration</h3>

      <div className="config-field">
        <label>API Key</label>
        <input
          type="text"
          placeholder="Enter your Cloudbeds API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <div className="config-field">
        <label>Property ID</label>
        <input
          type="text"
          placeholder="Enter property ID"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        />
      </div>

      <div className="config-field">
        <label>Main API URL</label>
        <input
          type="text"
          placeholder="https://api.cloudbeds.com/api/v1.3"
          value={mainApiUrl}
          onChange={(e) => setMainApiUrl(e.target.value)}
        />
      </div>

      <div className="config-section" style={{ marginTop: 20 }}>
        <h4>Other API URLs</h4>
        <p className="config-note" style={{ marginBottom: 12 }}>
          Service base URLs only. Endpoint paths are managed internally by the application.
        </p>
        {otherUrls.map((url, index) => (
          <div className="config-field" key={index}>
            <label>Other API URL {index + 1}</label>
            <div className="url-field-row">
              <input
                type="text"
                placeholder="https://"
                value={url}
                onChange={(e) => updateOtherUrl(index, e.target.value)}
              />
              {statusIndicator(otherStatuses[index], otherMessages[index])}
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn btn-primary"
        onClick={handleTestConnection}
        disabled={mainStatus === 'loading'}
        style={{ marginTop: 16 }}
      >
        {mainStatus === 'loading' ? 'Testing...' : 'Test Connection'}
      </button>

      <div className={`status-area status-area--${mainStatus === 'loading' ? 'idle' : mainStatus}`}>
        {mainMessage}
      </div>

      {showSavePrompt && (
        <div className="save-prompt">
          <p>Save this API configuration?</p>
          <div className="save-prompt-actions">
            <button className="btn btn-primary" onClick={handleSave}>
              Save
            </button>
            <button className="btn btn-secondary" onClick={handleDismissSave}>
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApiConfiguration;
