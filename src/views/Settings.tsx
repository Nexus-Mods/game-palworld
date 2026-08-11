import * as React from 'react';
import { ControlLabel, FormGroup, HelpBlock } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Toggle, types } from 'vortex-api';

import { setAutoManageRequirements } from '../actions';
import { NAMESPACE } from '../common';
import { isAutoManageEnabled } from '../selectors';

function Settings() {
  const { t } = useTranslation(NAMESPACE);
  const dispatch = useDispatch();
  const autoManage = useSelector((state: types.IState) => isAutoManageEnabled(state));
  const onToggle = React.useCallback((enabled: boolean) => {
    dispatch(setAutoManageRequirements(enabled));
  }, [dispatch]);
  return (
    <form>
      <FormGroup controlId='palworld-manage-requirements'>
        <ControlLabel>{t('Palworld')}</ControlLabel>
        <Toggle
          checked={autoManage}
          onToggle={onToggle}
        >
          {t('Manage modding requirements (UE4SS, Unreal Pak Tool) automatically')}
        </Toggle>
        <HelpBlock>
          {t('When enabled, Vortex installs UE4SS (Okaetsu RE-UE4SS) and the Unreal Pak Tool '
            + 'if they are missing, and notifies you when a newer UE4SS build is available. '
            + 'Copies you disable or remove are left alone. When disabled, Vortex never '
            + 'downloads or touches these requirements at all.')}
        </HelpBlock>
      </FormGroup>
    </form>
  );
}

export default Settings;
