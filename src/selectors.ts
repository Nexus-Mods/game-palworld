import { types } from 'vortex-api';

import { requirementsReducer } from './reducers';

// Defaults live in requirementsReducer; these read through to it so the fallback
//  isn't restated per call site.
function requirements(state: types.IState) {
  return state.settings?.['palworld']?.requirements ?? {};
}

export function isAutoManageEnabled(state: types.IState): boolean {
  return requirements(state).autoManage ?? requirementsReducer.defaults.autoManage;
}

export function lastRequirementsUpdateCheck(state: types.IState): number {
  return requirements(state).lastUpdateCheck ?? requirementsReducer.defaults.lastUpdateCheck;
}
