import { createAction } from 'redux-act';

export const setPalworldMigrationVersion = createAction('PALWORLD_SET_MIGRATION_VERSION', (version: string) => ({ version }));
