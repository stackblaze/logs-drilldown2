import React, { ChangeEvent, useState } from 'react';

import { css } from '@emotion/css';
import { isNumber } from 'lodash';
import { lastValueFrom } from 'rxjs';

import {
  AppPluginMeta,
  DataSourceInstanceSettings,
  GrafanaTheme2,
  PluginConfigPageProps,
  PluginMeta,
  rangeUtil,
} from '@grafana/data';
import { DataSourcePicker, getBackendSrv, locationService } from '@grafana/runtime';
import { Button, Checkbox, Field, FieldSet, Input, useStyles2 } from '@grafana/ui';

import { logger } from '../../services/logger';
import { getDefaultDatasourceFromDatasourceSrv, getLastUsedDataSourceFromStorage } from '../../services/store';

export type JsonData = {
  dataSource?: string;
  interval?: string;
  patternsDisabled?: boolean;
  layerLabelName?: string;
  namespaceFilterPrefix?: string;
};

type State = {
  dataSource: string;
  interval: string;
  isValid: boolean;
  patternsDisabled: boolean;
  layerLabelName: string;
  namespaceFilterPrefix: string;
};

// 1 hour minimum
const MIN_INTERVAL_SECONDS = 3600;

interface Props extends PluginConfigPageProps<AppPluginMeta<JsonData>> {}

const AppConfig = ({ plugin }: Props) => {
  const styles = useStyles2(getStyles);
  const { enabled, jsonData, pinned } = plugin.meta;

  const [state, setState] = useState<State>({
    dataSource:
      jsonData?.dataSource ?? getDefaultDatasourceFromDatasourceSrv() ?? getLastUsedDataSourceFromStorage() ?? '',
    interval: jsonData?.interval ?? '',
    isValid: isValid(jsonData?.interval ?? ''),
    patternsDisabled: jsonData?.patternsDisabled ?? false,
    layerLabelName: jsonData?.layerLabelName ?? 'layer_name',
    namespaceFilterPrefix: jsonData?.namespaceFilterPrefix ?? 'stackblaze',
  });

  const onChangeDatasource = (ds: DataSourceInstanceSettings) => {
    setState({
      ...state,
      dataSource: ds.uid,
    });
  };

  const onChangeInterval = (event: ChangeEvent<HTMLInputElement>) => {
    const interval = event.target.value.trim();
    setState({
      ...state,
      interval,
      isValid: isValid(interval),
    });
  };

  const onChangePatternsDisabled = (event: ChangeEvent<HTMLInputElement>) => {
    const patternsDisabled = event.currentTarget.checked;
    setState({
      ...state,
      patternsDisabled,
    });
  };

  const onChangeLayerLabelName = (event: ChangeEvent<HTMLInputElement>) => {
    const layerLabelName = event.target.value.trim();
    setState({
      ...state,
      layerLabelName,
    });
  };

  const onChangeNamespaceFilterPrefix = (event: ChangeEvent<HTMLInputElement>) => {
    const namespaceFilterPrefix = event.target.value.trim();
    setState({
      ...state,
      namespaceFilterPrefix,
    });
  };

  return (
    <div data-testid={testIds.appConfig.container}>
      <FieldSet label="Settings">
        <Field
          description={
            <span>
              The default data source to be used for new Logs Drilldown users. Each user can override their default by
              setting another data source in Logs Drilldown.
            </span>
          }
          label={'Default data source'}
        >
          <DataSourcePicker
            width={60}
            filter={(ds) => ds.type === 'loki'}
            current={state.dataSource}
            onChange={onChangeDatasource}
          />
        </Field>

        <Field
          invalid={!isValid(state.interval)}
          error={'Interval is invalid. Please enter an interval longer then "60m". For example: 3d, 1w, 1m'}
          description={
            <span>
              The maximum interval that can be selected in the time picker within the Grafana Logs Drilldown app. If
              empty, users can select any time range interval in Grafana Logs Drilldown. <br />
              Example values: 7d, 24h, 2w
            </span>
          }
          label={'Maximum time picker interval'}
          className={styles.marginTop}
        >
          <Input
            width={60}
            id="interval"
            data-testid={testIds.appConfig.interval}
            label={`Max interval`}
            value={state?.interval}
            placeholder={`7d`}
            onChange={onChangeInterval}
          />
        </Field>

        <Field
          className={styles.marginTop}
          description={
            <span>
              Disables Logs Drilldown&apos;s usage of the{' '}
              <a
                className="external-link"
                href="https://grafana.com/docs/loki/latest/reference/loki-http-api/#patterns-detection"
                target="_blank"
                rel="noreferrer"
              >
                Loki Patterns API
              </a>{' '}
              endpoint, and removes the Patterns tab.
            </span>
          }
          label={'Disable Loki patterns'}
        >
          <Checkbox
            id="disable-patterns"
            data-testid={testIds.appConfig.interval}
            label={`Disable patterns`}
            value={state?.patternsDisabled}
            placeholder={`7d`}
            onChange={onChangePatternsDisabled}
          />
        </Field>

        <Field
          className={styles.marginTop}
          description={
            <span>
              The Loki label name to use for layer filtering. This label will be used to populate the Layer dropdown in
              the service detail view.
              <br />
              Example values: layer_name, layer, app, tier, component
            </span>
          }
          label={'Layer label name'}
        >
          <Input
            width={60}
            id="layer-label-name"
            data-testid={testIds.appConfig.layerLabelName}
            label={`Layer label name`}
            value={state?.layerLabelName}
            placeholder={`layer_name`}
            onChange={onChangeLayerLabelName}
          />
        </Field>

        <Field
          className={styles.marginTop}
          description={
            <span>
              Only show namespaces that start with this prefix. This helps filter the namespace list to only show
              relevant stacks.
              <br />
              Example values: stackblaze, myapp, prod
            </span>
          }
          label={'Namespace filter prefix'}
        >
          <Input
            width={60}
            id="namespace-filter-prefix"
            data-testid={testIds.appConfig.namespaceFilterPrefix}
            label={`Namespace filter prefix`}
            value={state?.namespaceFilterPrefix}
            placeholder={`stackblaze`}
            onChange={onChangeNamespaceFilterPrefix}
          />
        </Field>

        <div className={styles.marginTop}>
          <Button
            type="submit"
            data-testid={testIds.appConfig.submit}
            onClick={() =>
              updatePluginAndReload(plugin.meta.id, {
                enabled,
                jsonData: {
                  dataSource: state.dataSource,
                  interval: state.interval,
                  patternsDisabled: state.patternsDisabled,
                  layerLabelName: state.layerLabelName,
                  namespaceFilterPrefix: state.namespaceFilterPrefix,
                },
                pinned,
              })
            }
            disabled={!isValid(state.interval)}
          >
            Save settings
          </Button>
        </div>
        <p className={styles.note}>Active users must refresh the app to update configuration.</p>
      </FieldSet>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  colorWeak: css`
    color: ${theme.colors.text.secondary};
  `,
  icon: css({
    marginLeft: theme.spacing(1),
  }),
  label: css({
    alignItems: 'center',
    display: 'flex',
    marginBottom: theme.spacing(0.75),
  }),
  marginTop: css`
    margin-top: ${theme.spacing(3)};
  `,
  marginTopXl: css`
    margin-top: ${theme.spacing(6)};
  `,
  note: css({
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(1),
  }),
});

const updatePluginAndReload = async (pluginId: string, data: Partial<PluginMeta<JsonData>>) => {
  try {
    await updatePlugin(pluginId, data);

    // Reloading the page as the changes made here wouldn't be propagated to the actual plugin otherwise.
    // This is not ideal, however unfortunately currently there is no supported way for updating the plugin state.
    locationService.reload();
  } catch (e) {
    logger.error(e, { msg: 'Error while updating the plugin' });
  }
};

const testIds = {
  appConfig: {
    container: 'data-testid ac-container',
    datasource: 'data-testid ac-datasource-input',
    interval: 'data-testid ac-interval-input',
    layerLabelName: 'data-testid ac-layer-label-name-input',
    namespaceFilterPrefix: 'data-testid ac-namespace-filter-prefix-input',
    pattern: 'data-testid ac-patterns-disabled',
    submit: 'data-testid ac-submit-form',
  },
};

export const updatePlugin = async (pluginId: string, data: Partial<PluginMeta>) => {
  const response = getBackendSrv().fetch({
    data,
    method: 'POST',
    url: `/api/plugins/${pluginId}/settings`,
  });

  const dataResponse = await lastValueFrom(response);

  return dataResponse.data;
};

const isValid = (interval: string): boolean => {
  try {
    if (interval) {
      const seconds = rangeUtil.intervalToSeconds(interval);
      return isNumber(seconds) && seconds >= MIN_INTERVAL_SECONDS;
    } else {
      // Empty strings are fine
      return true;
    }
  } catch (e) {}

  return false;
};

export default AppConfig;
