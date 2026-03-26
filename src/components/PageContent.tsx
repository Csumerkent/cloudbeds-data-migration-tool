import type { NavItem } from './Sidebar';

interface PageContentProps {
  page: NavItem;
}

function PageContent({ page }: PageContentProps) {
  return (
    <div className="page-content">
      <h2>{page}</h2>
      <p className="page-placeholder">This section is not yet implemented.</p>
    </div>
  );
}

export default PageContent;
