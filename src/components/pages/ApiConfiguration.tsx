import { useState } from 'react';
import './pages.css';

type ConnectionStatus = 'idle' | 'success' | 'error';

interface OtherUrl {
  label: string;
  value: string;
}

const INITIAL_OTHER_URLS: OtherUrl[] = [
  { label: 'Get Room Types', value: '/getRoomTypes' },
  { label: 'Get Rooms', value: '/getRooms' },
  { label: 'Get Sources', value: '/getSources' },
  { label: 'Get Rate Plans', value: '/getRatePlans' },
  { label: 'Post Reservation', value: '/postReservation' },
  { label: 'Get Guests', value: '/getGuests' },
  { label: 'Get Transactions', value: '/getTransactions' },
  { label: '', value: '' },
  { label: '', value: '' },
  { label: '', value: '' },
];

function ApiConfiguration() {
  const [apiKey, setApiKey] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [mainApiUrl, setMainApiUrl] = useState('https://api.cloudbeds.com/api/v1.2');
  const [otherUrls, setOtherUrls] = useState<OtherUrl[]>(INITIAL_OTHER_URLS);
  const [status, setStatus] = useState<ConnectionStatus>('idle');

  const handleTestConnection = () => {
    // Placeholder: simulate local UI state only, no real API call
    if (mainApiUrl && apiKey && propertyId) {
      setStatus('success');
    } else {
      setStatus('error');
    }
  };

  const updateOtherUrl = (index: number, field: keyof OtherUrl, value: string) => {
    setOtherUrls((prev) =>
      prev.map((u, i) => (i === index ? { ...u, [field]: value } : u)),
    );
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
          placeholder="https://api.cloudbeds.com/api/v1.2"
          value={mainApiUrl}
          onChange={(e) => setMainApiUrl(e.target.value)}
        />
      </div>

      <div className="config-section" style={{ marginTop: 20 }}>
        <h4>Other API URLs</h4>
        {otherUrls.map((url, index) => (
          <div className="config-row" key={index}>
            <div className="config-field">
              <label>Service Name</label>
              <input
                type="text"
                placeholder={`Service ${index + 1}`}
                value={url.label}
                onChange={(e) => updateOtherUrl(index, 'label', e.target.value)}
              />
            </div>
            <div className="config-field">
              <label>URL Path</label>
              <input
                type="text"
                placeholder="/endpoint"
                value={url.value}
                onChange={(e) => updateOtherUrl(index, 'value', e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        className="btn btn-primary"
        onClick={handleTestConnection}
        style={{ marginTop: 16 }}
      >
        Test Connection
      </button>

      <div className={`status-area status-area--${status}`}>
        {statusMessages[status]}
      </div>
    </div>
  );
}

export default ApiConfiguration;
