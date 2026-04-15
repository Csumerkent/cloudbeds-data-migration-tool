import ApiConfiguration from './pages/ApiConfiguration';
import DebugTool from './pages/DebugTool';
import RateConfiguration from './pages/RateConfiguration';
import RoomConfiguration from './pages/RoomConfiguration';
import SourceConfiguration from './pages/SourceConfiguration';
import SystemSettings from './pages/SystemSettings';
import MigrationPage from './MigrationPage';
import PageShell from './PageShell';
import ReportingSession from './ReportingSession';
import type { SidebarItemId } from './Sidebar';

interface PageContentProps {
  page: SidebarItemId;
  onNavigate: (item: SidebarItemId) => void;
}

function PageContent({ page, onNavigate }: PageContentProps) {
  switch (page) {
    case 'api-config':
      return (
        <PageShell
          eyebrow="Setup"
          title="API Configuration"
          description="Manage Cloudbeds connectivity, property identity, and the supporting service endpoints required before any mapping or migration run."
          badge="Connection Layer"
        >
          <ApiConfiguration />
        </PageShell>
      );
    case 'source-config':
      return (
        <PageShell
          eyebrow="Mapping"
          title="Source Configuration"
          description="Resolve former PMS source names against Cloudbeds source records so reservation imports land in the right operational context."
          badge="Mapping Control"
        >
          <SourceConfiguration />
        </PageShell>
      );
    case 'room-config':
      return (
        <PageShell
          eyebrow="Mapping"
          title="Room Configuration"
          description="Align Cloudbeds room types and room numbers with the legacy PMS structure to protect inventory accuracy during migration."
          badge="Inventory Mapping"
        >
          <RoomConfiguration />
        </PageShell>
      );
    case 'rate-config':
      return (
        <PageShell
          eyebrow="Mapping"
          title="Rate Configuration"
          description="Confirm rate plan naming and date boundaries so migrated reservations resolve to the correct Cloudbeds pricing objects."
          badge="Rate Mapping"
        >
          <RateConfiguration />
        </PageShell>
      );
    case 'reservation':
      return <MigrationPage variant="reservation" onNavigate={onNavigate} />;
    case 'reservation-detail':
      return <MigrationPage variant="reservation-detail" onNavigate={onNavigate} />;
    case 'profiles':
      return <MigrationPage variant="profiles" onNavigate={onNavigate} />;
    case 'finance':
      return <MigrationPage variant="finance" onNavigate={onNavigate} />;
    case 'reporting':
      return <ReportingSession />;
    case 'logs':
      return (
        <PageShell
          eyebrow="Logs"
          title="Operational Logs"
          description="Search technical traces and migration events when operators need visibility into validation, execution, and runtime issues."
          badge="Troubleshooting"
        >
          <DebugTool />
        </PageShell>
      );
    case 'system':
      return (
        <PageShell
          eyebrow="System"
          title="System Settings"
          description="Configure app-level operating behavior for desktop migration sessions, including the controlled business date/time used by the tool."
          badge="Application Controls"
        >
          <SystemSettings />
        </PageShell>
      );
    default:
      return null;
  }
}

export default PageContent;
