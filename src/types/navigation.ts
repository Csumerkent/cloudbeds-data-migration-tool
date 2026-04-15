export type MigrationModuleScope =
  | 'Reservation'
  | 'Reservation Detail'
  | 'Profiles'
  | 'Finance';

export interface NavigationFilters {
  moduleScope?: MigrationModuleScope;
  fileName?: string;
  jobId?: string;
  chunkId?: string;
  invalidRowsOnly?: boolean;
  migrationLogsOnly?: boolean;
}
