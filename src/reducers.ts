import { types, util } from 'vortex-api';
import { setPalworldMigrationVersion } from './actions';

export const settingsReducer: types.IReducerSpec = {
  reducers: {
    [setPalworldMigrationVersion as any]: (state, payload) => {
      const { version } = payload;
      return util.setSafe(state, ['palworldMigrationVersion'], version);
    },
  },
  defaults: {},
};
