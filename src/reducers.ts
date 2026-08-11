import { types, util } from 'vortex-api';
import { setAutoManageRequirements, setPalworldMigrationVersion, setRequirementsUpdateChecked } from './actions';

export const settingsReducer: types.IReducerSpec = {
  reducers: {
    [setPalworldMigrationVersion as any]: (state, payload) => {
      const { version } = payload;
      return util.setSafe(state, ['palworldMigrationVersion'], version);
    },
  },
  defaults: {},
};

export const requirementsReducer: types.IReducerSpec = {
  reducers: {
    [setAutoManageRequirements as any]: (state, payload) =>
      ({ ...state, autoManage: payload.enabled }),
    [setRequirementsUpdateChecked as any]: (state, payload) =>
      ({ ...state, lastUpdateCheck: payload.timestamp }),
  },
  defaults: {
    autoManage: true,
    lastUpdateCheck: 0,
  },
};
