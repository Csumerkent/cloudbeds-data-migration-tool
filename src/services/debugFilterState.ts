// --- Pending Debug Filter ---
// A tiny cross-page handoff used when other screens (e.g. Excel Review /
// Execution) want to open the Debug Tool already filtered to a subset of
// logs (a specific file, module, run, or log level). The source screen
// sets a pending filter and fires the global `navigate-to-page` event;
// the Debug Tool reads + clears it on mount.
//
// Keeping this as a module-level singleton avoids prop drilling through
// App -> PageContent -> ProjectSetup -> ExcelConfiguration.

import type { LogLevel } from './debugLogger';

export type DebugTab = 'all' | 'migration';

export interface PendingDebugFilter {
  tab?: DebugTab;
  level?: LogLevel | 'ALL';
  module?: string;
  // Free-form text applied to the search input; both module/step/message
  // and payload JSON are matched, so we use it to pin the view to a
  // specific file name or run id.
  search?: string;
}

let pending: PendingDebugFilter | null = null;

export function setPendingDebugFilter(filter: PendingDebugFilter | null): void {
  pending = filter;
}

export function consumePendingDebugFilter(): PendingDebugFilter | null {
  const f = pending;
  pending = null;
  return f;
}
