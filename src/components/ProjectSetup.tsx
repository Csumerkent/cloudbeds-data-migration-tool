import { useState } from 'react';
import ApiConfiguration from './pages/ApiConfiguration';
import SourceConfiguration from './pages/SourceConfiguration';
import RoomConfiguration from './pages/RoomConfiguration';
import RateConfiguration from './pages/RateConfiguration';
import ExcelConfiguration from './pages/ExcelConfiguration';

const SETUP_TABS = [
  'API Configuration',
  'Source Configuration',
  'Room Configuration',
  'Rate Configuration',
  'Excel',
] as const;

type SetupTab = (typeof SETUP_TABS)[number];

const TAB_COMPONENTS: Record<SetupTab, React.FC> = {
  'API Configuration': ApiConfiguration,
  'Source Configuration': SourceConfiguration,
  'Room Configuration': RoomConfiguration,
  'Rate Configuration': RateConfiguration,
  'Excel': ExcelConfiguration,
};

function ProjectSetup() {
  const [activeTab, setActiveTab] = useState<SetupTab>('API Configuration');
  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="project-setup">
      <h2>Project Setup</h2>
      <nav className="setup-tabs">
        {SETUP_TABS.map((tab) => (
          <button
            key={tab}
            className={`setup-tab${tab === activeTab ? ' setup-tab--active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>
      <div className="setup-content">
        <ActiveComponent />
      </div>
    </div>
  );
}

export default ProjectSetup;
