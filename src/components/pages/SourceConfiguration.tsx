import { useState } from 'react';
import './pages.css';

interface SourceRow {
  label: string;
  sourceName: string;
  sourceId: string;
}

const INITIAL_SOURCES: SourceRow[] = [
  { label: 'Old Reservations', sourceName: '', sourceId: '' },
  { label: 'New Reservations', sourceName: '', sourceId: '' },
];

function SourceConfiguration() {
  const [sources, setSources] = useState<SourceRow[]>(INITIAL_SOURCES);

  const updateSourceName = (index: number, value: string) => {
    setSources((prev) =>
      prev.map((s, i) => (i === index ? { ...s, sourceName: value } : s)),
    );
  };

  const handleGet = (index: number) => {
    // Placeholder: simulate resolving a source ID locally
    setSources((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, sourceId: s.sourceName ? `src-${index + 1}-placeholder` : '' }
          : s,
      ),
    );
  };

  return (
    <div className="config-page">
      <h3>Source Configuration</h3>

      <div className="config-note">
        Define the source names for old and new reservations. The application will
        resolve each source name to a Cloudbeds Source ID when connected to the API.
        For now, enter the source names as they appear in your PMS system.
      </div>

      {sources.map((source, index) => (
        <div className="config-section" key={source.label}>
          <h4>{source.label}</h4>
          <div className="config-row">
            <div className="config-field">
              <label>Source Name</label>
              <input
                type="text"
                placeholder="Enter source name"
                value={source.sourceName}
                onChange={(e) => updateSourceName(index, e.target.value)}
              />
            </div>
            <button className="btn btn-secondary" onClick={() => handleGet(index)}>
              Get
            </button>
            <div className="config-field">
              <label>Source ID</label>
              <input type="text" readOnly value={source.sourceId} placeholder="—" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default SourceConfiguration;
