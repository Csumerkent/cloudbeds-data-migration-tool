import { useState } from 'react';
import Sidebar, { type NavItem } from '../components/Sidebar';
import PageContent from '../components/PageContent';
import '../components/Sidebar.css';
import './App.css';

function App() {
  const [activePage, setActivePage] = useState<NavItem>('Project Setup');

  return (
    <div className="app">
      <header className="app-header">
        <h1>Cloudbeds Data Migration Tool</h1>
        <p>v0.1.0</p>
      </header>
      <div className="app-body">
        <Sidebar active={activePage} onSelect={setActivePage} />
        <main className="app-main">
          <PageContent page={activePage} />
        </main>
      </div>
    </div>
  );
}

export default App;
