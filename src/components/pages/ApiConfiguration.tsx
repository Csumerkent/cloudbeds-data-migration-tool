import { useState } from 'react';
import { testConnection } from '../../services/apiConfigurationService';
import './pages.css';

type ConnectionStatus = 'idle' | 'loading' | 'success' | 'error';

const INITIAL_OTHER_URLS: string[] = [
  'https://api.cloudbeds.com/accounting/v1.0',
  'https://api.cloudbeds.com/fiscal-document/v1',
  'https://api.cloudbeds.com/group-profile/v1',
  'https://api.cloudbeds.com/payments/v2',
  'https://api.cloudbeds.com/datainsights/v1.1',
  'https://api.cloudbeds.com',
  '',
  '',
  '',
  '',
];

function ApiConfiguration() {
  const [apiKey, setApiKey] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [mainApiUrl, setMainApiUrl] = useState('https://api.cloudbeds.com/api/v1.3');
  const [otherUrls, setOtherUrls] = useState<string[]>(INITIAL_OTHER_URLS);
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('Not tested yet.');

  const handleTestConnection = async () => {
    setStatus('loading');
    setStatusMessage('Testing connection...');

    const result = await testConnection({ mainApiUrl, apiKey, propertyId });

    setStatus(result.success ? 'success' : 'error');
    setStatusMessage(result.message);
  };

  const updateOtherUrl = (index: number, value: string) => {
    setOtherUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
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
            <input
              type="text"
              placeholder="https://"
              value={url}
              onChange={(e) => updateOtherUrl(index, e.target.value)}
            />
          </div>
        ))}
      </div>

      <button
        className="btn btn-primary"
        onClick={handleTestConnection}
        disabled={status === 'loading'}
        style={{ marginTop: 16 }}
      >
        {status === 'loading' ? 'Testing...' : 'Test Connection'}
      </button>

      <div className={`status-area status-area--${status === 'loading' ? 'idle' : status}`}>
        {statusMessage}
      </div>
    </div>
  );
}

export default ApiConfiguration;
