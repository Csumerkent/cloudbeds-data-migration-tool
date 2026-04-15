import Icon, { type IconName } from './Icons';

export type SidebarItemId =
  | 'api-config'
  | 'source-config'
  | 'room-config'
  | 'rate-config'
  | 'reservation'
  | 'reservation-detail'
  | 'profiles'
  | 'finance'
  | 'reporting'
  | 'logs'
  | 'system';

export type SidebarGroupId = 'configuration' | 'mapping' | 'migration' | 'report' | 'log' | 'settings';

interface SidebarChild {
  id: SidebarItemId;
  label: string;
  icon: IconName;
}

interface SidebarGroup {
  id: SidebarGroupId;
  label: string;
  icon: IconName;
  children: SidebarChild[];
}

export const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    id: 'configuration',
    label: 'Configuration',
    icon: 'settings',
    children: [{ id: 'api-config', label: 'API Configuration', icon: 'key' }],
  },
  {
    id: 'mapping',
    label: 'Mapping',
    icon: 'link',
    children: [
      { id: 'source-config', label: 'Source Configuration', icon: 'link' },
      { id: 'room-config', label: 'Room Configuration', icon: 'bed' },
      { id: 'rate-config', label: 'Rate Configuration', icon: 'tag' },
    ],
  },
  {
    id: 'migration',
    label: 'Migration',
    icon: 'calendar',
    children: [
      { id: 'reservation', label: 'Reservation', icon: 'calendar' },
      { id: 'reservation-detail', label: 'Reservation Detail', icon: 'file' },
      { id: 'profiles', label: 'Profiles', icon: 'users' },
      { id: 'finance', label: 'Finance', icon: 'receipt' },
    ],
  },
  {
    id: 'report',
    label: 'Report',
    icon: 'chart',
    children: [{ id: 'reporting', label: 'Reports', icon: 'chart' }],
  },
  {
    id: 'log',
    label: 'Log',
    icon: 'file',
    children: [{ id: 'logs', label: 'System Logs', icon: 'file' }],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'server',
    children: [{ id: 'system', label: 'System Settings', icon: 'server' }],
  },
];

interface SidebarProps {
  active: SidebarItemId;
  expandedGroups: Record<SidebarGroupId, boolean>;
  onSelect: (item: SidebarItemId) => void;
  onToggleGroup: (group: SidebarGroupId) => void;
}

function Sidebar({ active, expandedGroups, onSelect, onToggleGroup }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__panel">
        {SIDEBAR_GROUPS.map((group) => {
          const isExpanded = expandedGroups[group.id];
          const hasActiveChild = group.children.some((child) => child.id === active);

          return (
            <section
              key={group.id}
              className={`sidebar-group${hasActiveChild ? ' sidebar-group--active' : ''}`}
            >
              <button
                type="button"
                className="sidebar-group__header"
                onClick={() => onToggleGroup(group.id)}
              >
                <div className="sidebar-group__title">
                  <span className="sidebar-group__icon">
                    <Icon name={group.icon} size={18} />
                  </span>
                  <span>{group.label}</span>
                </div>
                <Icon
                  name="chevron-right"
                  size={14}
                  className={`sidebar-group__chevron${isExpanded ? ' sidebar-group__chevron--open' : ''}`}
                />
              </button>

              {isExpanded ? (
                <div className="sidebar-group__children">
                  {group.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      className={`sidebar-child${child.id === active ? ' sidebar-child--active' : ''}`}
                      onClick={() => onSelect(child.id)}
                    >
                      <Icon name={child.icon} size={16} className="sidebar-child__icon" />
                      <span>{child.label}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </aside>
  );
}

export default Sidebar;
