import type { NavItem } from './Sidebar';
import ProjectSetup from './ProjectSetup';

interface PageContentProps {
  page: NavItem;
}

function PageContent({ page }: PageContentProps) {
  if (page === 'Project Setup') {
    return <ProjectSetup />;
  }

  return (
    <div className="page-content">
      <h2>{page}</h2>
      <p className="page-placeholder">This section is not yet implemented.</p>
    </div>
  );
}

export default PageContent;
