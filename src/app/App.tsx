import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icons';
import blueCloudLogo from '../assets/blue_cloud.png';
import yellowSwirlLogo from '../assets/yellow_swirl.png';
import Sidebar, {
  SIDEBAR_GROUPS,
  type SidebarGroupId,
  type SidebarItemId,
} from '../components/Sidebar';
import PageContent from '../components/PageContent';
import '../components/Sidebar.css';
import './App.css';

type AppMenuKey = 'File' | 'Edit' | 'View' | 'Window' | 'Help';

interface MenuEntry {
  label: string;
  action: string;
}

const APP_MENUS: Record<AppMenuKey, MenuEntry[]> = {
  File: [
    { label: 'Reload App', action: 'file:reload-app' },
    { label: 'Exit App', action: 'file:exit-app' },
  ],
  Edit: [
    { label: 'Undo', action: 'edit:undo' },
    { label: 'Redo', action: 'edit:redo' },
    { label: 'Cut', action: 'edit:cut' },
    { label: 'Copy', action: 'edit:copy' },
    { label: 'Paste', action: 'edit:paste' },
  ],
  View: [
    { label: 'Reload', action: 'view:reload' },
    { label: 'Toggle Developer Tools', action: 'view:toggle-devtools' },
  ],
  Window: [
    { label: 'Minimize', action: 'window:minimize' },
    { label: 'Toggle Maximize', action: 'window:toggle-maximize' },
  ],
  Help: [{ label: 'Cloudbeds Website', action: 'help:cloudbeds' }],
};

const DEFAULT_EXPANDED_GROUPS: Record<SidebarGroupId, boolean> = {
  configuration: true,
  mapping: true,
  migration: true,
  report: true,
  log: true,
  settings: true,
};

function App() {
  const [activePage, setActivePage] = useState<SidebarItemId>('api-config');
  const [expandedGroups, setExpandedGroups] = useState<Record<SidebarGroupId, boolean>>(DEFAULT_EXPANDED_GROUPS);
  const [openMenu, setOpenMenu] = useState<AppMenuKey | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(() =>
    new Date().toLocaleString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  );

  useEffect(() => {
    const handleWindowClick = () => setOpenMenu(null);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};

    const syncWindowState = async () => {
      const state = await window.electronAPI.getWindowState();
      setIsMaximized(state.isMaximized);
      unsubscribe = window.electronAPI.onWindowStateChanged((nextState) => {
        setIsMaximized(nextState.isMaximized);
      });
    };

    void syncWindowState();

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentDateTime(
        new Date().toLocaleString('en-GB', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const activeSectionLabel = useMemo(() => {
    const group = SIDEBAR_GROUPS.find((entry) => entry.children.some((child) => child.id === activePage));
    return group?.label ?? 'Workspace';
  }, [activePage]);

  const handleSidebarSelect = (item: SidebarItemId) => {
    setActivePage(item);
  };

  const handleToggleGroup = (group: SidebarGroupId) => {
    setExpandedGroups((current) => ({
      ...current,
      [group]: !current[group],
    }));
  };

  const handleMenuAction = async (action: string) => {
    setOpenMenu(null);
    await window.electronAPI.menuAction(action);
  };

  const handleWindowAction = async (action: 'minimize' | 'toggle-maximize' | 'close') => {
    const result = await window.electronAPI.windowAction(action);
    setIsMaximized(result.isMaximized);
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header__topline">
          <div className="app-header__drag-region">
            <div className="app-header__titlebar">
              <div className="app-header__titlebar-icon-wrap">
                <img
                  src={yellowSwirlLogo}
                  alt="Yellow swirl logo"
                  className="app-header__titlebar-icon"
                />
              </div>
              <span className="app-header__titlebar-time">{currentDateTime}</span>
            </div>
          </div>

          <div className="app-header__window-controls">
            <button
              type="button"
              className="app-header__window-button"
              aria-label="Minimize"
              onClick={() => void handleWindowAction('minimize')}
            >
              <Icon name="minus" size={16} />
            </button>
            <button
              type="button"
              className="app-header__window-button"
              aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
              onClick={() => void handleWindowAction('toggle-maximize')}
            >
              <Icon name={isMaximized ? 'copy-square' : 'square'} size={14} />
            </button>
            <button
              type="button"
              className="app-header__window-button app-header__window-button--close"
              aria-label="Close"
              onClick={() => void handleWindowAction('close')}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        <div className="app-header__menu-row">
          <div className="app-header__menu-bar app-header__no-drag" onClick={(event) => event.stopPropagation()}>
            {(Object.keys(APP_MENUS) as AppMenuKey[]).map((menuName) => (
              <div key={menuName} className="app-header__menu-item">
                <button
                  type="button"
                  className={`app-header__menu-button${openMenu === menuName ? ' app-header__menu-button--active' : ''}`}
                  onClick={() => setOpenMenu((current) => (current === menuName ? null : menuName))}
                >
                  {menuName}
                </button>
                {openMenu === menuName ? (
                  <div className="app-header__dropdown">
                    {APP_MENUS[menuName].map((entry) => (
                      <button
                        key={entry.action}
                        type="button"
                        className="app-header__dropdown-item"
                        onClick={() => handleMenuAction(entry.action)}
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="app-header__tools app-header__no-drag">
            <button type="button" className="app-header__profile" aria-label="User profile">
              <Icon name="user" size={18} />
            </button>
          </div>
        </div>

        <div className="app-header__brand">
          <div className="app-header__hero-logo">
            <img
              src={blueCloudLogo}
              alt="Blue cloud logo"
              className="app-header__hero-logo-image"
            />
          </div>
          <div>
            <h1>Cloudbeds Data Migration Tool</h1>
            <p>{activeSectionLabel} workspace</p>
          </div>
        </div>
      </header>

      <div className="workspace">
        <Sidebar
          active={activePage}
          expandedGroups={expandedGroups}
          onSelect={handleSidebarSelect}
          onToggleGroup={handleToggleGroup}
        />
        <main className="workspace__main">
          <PageContent page={activePage} onNavigate={handleSidebarSelect} />
        </main>
      </div>
    </div>
  );
}

export default App;
