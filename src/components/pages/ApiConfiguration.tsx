import { useState } from 'react';
import './pages.css';

type ConnectionStatus = 'idle' | 'success' | 'error';

function ApiConfiguration() {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [status, setStatus] = useState<ConnectionStatus>('idle');

  const handleTestConnection = () => {
    // Placeholder: simulate local UI state only, no real API call
    if (baseUrl && apiKey && propertyId) {
      setStatus('success');
    } else {
      setStatus('error');
    }
  };

  const statusMessages: Record<ConnectionStatus, string> = {
    idle: 'Not tested yet.',
    success: 'Connection parameters look valid. (No real API call made.)',
    error: 'Please fill in all fields before testing.',
  };

  return (
    <div className="config-page">
      <h3>API Configuration</h3>

      <div className="config-field">
        <label>API Base URL</label>
        <input
          type="text"
          placeholder="https://api.cloudbeds.com/api/v1.2"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>

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

      <button className="btn btn-primary" onClick={handleTestConnection}>
        Test Connection
      </button>

      <div className={`status-area status-area--${status}`}>
        {statusMessages[status]}
      </div>
    </div>
  );
}

export default ApiConfiguration;
