import { useEffect, useState } from 'react';
import Sidebar, { NAV_ITEMS, type NavItem } from '../components/Sidebar';
import PageContent from '../components/PageContent';
import '../components/Sidebar.css';
import './App.css';

function App() {
  const [activePage, setActivePage] = useState<NavItem>('Project Setup');

  // Global navigation handle: other screens dispatch a `navigate-to-page`
  // CustomEvent to jump to a specific sidebar entry (e.g. "Debug Tool")
  // without needing props drilled in from App.
  useEffect(() => {
    const handler = (e: Event) => {
      const target = (e as CustomEvent).detail;
      if (typeof target === 'string' && (NAV_ITEMS as readonly string[]).includes(target)) {
        setActivePage(target as NavItem);
      }
    };
    window.addEventListener('navigate-to-page', handler as EventListener);
    return () => window.removeEventListener('navigate-to-page', handler as EventListener);
  }, []);

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
