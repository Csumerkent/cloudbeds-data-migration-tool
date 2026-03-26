export const NAV_ITEMS = [
  'Project Setup',
  'Discovery',
  'Template',
  'Validation',
  'Simulation',
  'Execution',
  'Reporting',
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

interface SidebarProps {
  active: NavItem;
  onSelect: (item: NavItem) => void;
}

function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <nav className="sidebar">
      <ul className="sidebar-list">
        {NAV_ITEMS.map((item) => (
          <li key={item}>
            <button
              className={`sidebar-item${item === active ? ' sidebar-item--active' : ''}`}
              onClick={() => onSelect(item)}
            >
              {item}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default Sidebar;
