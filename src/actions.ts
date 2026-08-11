import { createAction } from 'redux-act';

export const setPalworldMigrationVersion = createAction('PALWORLD_SET_MIGRATION_VERSION', (version: string) => ({ version }));

export const setAutoManageRequirements = createAction('PALWORLD_SET_AUTO_MANAGE_REQUIREMENTS', (enabled: boolean) => ({ enabled }));

export const setRequirementsUpdateChecked = createAction('PALWORLD_SET_REQUIREMENTS_UPDATE_CHECKED', (timestamp: number) => ({ timestamp }));
