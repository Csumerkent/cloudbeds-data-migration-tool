import { useState } from 'react';
import './pages.css';

interface RateRow {
  label: string;
  ratePlanNamePublic: string;
  resolvedDisplay: string;
}

const INITIAL_RATES: RateRow[] = [
  { label: 'Old Reservations Rate', ratePlanNamePublic: '', resolvedDisplay: '' },
  { label: 'New Reservations Rate', ratePlanNamePublic: '', resolvedDisplay: '' },
];

function RateConfiguration() {
  const [rates, setRates] = useState<RateRow[]>(INITIAL_RATES);

  const updateRateName = (index: number, value: string) => {
    setRates((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, ratePlanNamePublic: value, resolvedDisplay: '' } : r,
      ),
    );
  };

  return (
    <div className="config-page">
      <h3>Rate Configuration</h3>

      <div className="config-note">
        Enter the <strong>ratePlanNamePublic</strong> for each reservation category.
        When connected to the Cloudbeds API, the application will resolve this to a{' '}
        <strong>rateID</strong>. The final reservation payload will use the
        corresponding <strong>roomRateID</strong>.<br /><br />
        Rate resolution is not active yet — enter the public rate plan names for now.
      </div>

      {rates.map((rate, index) => (
        <div className="config-section" key={rate.label}>
          <h4>{rate.label}</h4>
          <div className="config-row">
            <div className="config-field">
              <label>Rate Plan Public Name</label>
              <input
                type="text"
                placeholder="e.g. Standard Rate"
                value={rate.ratePlanNamePublic}
                onChange={(e) => updateRateName(index, e.target.value)}
              />
            </div>
            <div className="config-field">
              <label>Resolved Rate (read-only)</label>
              <input
                type="text"
                readOnly
                value={rate.resolvedDisplay}
                placeholder="Will be resolved via API"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default RateConfiguration;
