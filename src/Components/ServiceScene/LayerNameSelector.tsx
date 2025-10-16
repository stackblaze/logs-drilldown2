import React, { useEffect, useState } from 'react';

import { css } from '@emotion/css';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
import { DataSourceWithBackend, getDataSourceSrv } from '@grafana/runtime';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { Field, Select, useStyles2 } from '@grafana/ui';

import { LokiDatasource } from '../../services/lokiDatasource';
import { logger } from '../../services/logger';
import { getRouteParams } from '../../services/routing';
import { getDataSourceVariable, getLabelsVariable } from '../../services/variableGetters';
import { SERVICE_NAME, SERVICE_UI_LABEL } from '../../services/variables';
import { IndexScene } from '../IndexScene/IndexScene';
import { ServiceScene } from './ServiceScene';

interface LayerNameSelectorState extends SceneObjectState {
  layerOptions?: Array<SelectableValue<string>>;
  selectedLayer?: string;
  isLoading?: boolean;
}

export class LayerNameSelector extends SceneObjectBase<LayerNameSelectorState> {
  constructor(state?: Partial<LayerNameSelectorState>) {
    super({
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  static Component = ({ model }: SceneComponentProps<LayerNameSelector>) => {
    const { layerOptions, selectedLayer, isLoading } = model.useState();
    const styles = useStyles2(getStyles);

    // Check if we're in a ServiceScene context (after all hooks)
    // ServiceScene is a sibling, not ancestor, so we need to find it from IndexScene
    let serviceScene: ServiceScene | null = null;
    let labelName: string | undefined;
    let labelValue: string | undefined;
    
    try {
      const indexScene = sceneGraph.getAncestor(model, IndexScene);
      serviceScene = sceneGraph.findObject(indexScene, (obj) => obj instanceof ServiceScene) as ServiceScene | null;
      if (serviceScene) {
        ({ labelName, labelValue } = getRouteParams(serviceScene));
        window.console.log('[LayerNameSelector] Found ServiceScene:', labelName, '=', labelValue);
      } else {
        window.console.log('[LayerNameSelector] ServiceScene not found in scene tree');
      }
    } catch (error) {
      window.console.log('[LayerNameSelector] Error finding ServiceScene:', error);
    }
    
    // Don't render if we're not in a ServiceScene context or if we don't have labelName/labelValue
    if (!serviceScene || !labelName || !labelValue) {
      window.console.log('[LayerNameSelector] Returning null - no ServiceScene or no labelName/labelValue');
      return null;
    }
    
    const options = layerOptions || [{ label: 'All layers', value: '' }];
    window.console.log('[LayerNameSelector] Rendering dropdown with', options.length, 'options');

    const handleChange = (option: SelectableValue<string>) => {
      model.onLayerChange(option.value || '');
    };

    return (
      <Field label="Layer" className={styles.field}>
        <Select
          value={selectedLayer || ''}
          options={options}
          onChange={handleChange}
          placeholder="Select layer"
          width={40}
          isLoading={isLoading}
        />
      </Field>
    );
  };

  onActivate() {
    window.console.log('[LayerNameSelector] onActivate called');
    // Check if we're in a ServiceScene context
    // ServiceScene is a sibling, not ancestor, so we need to find it from IndexScene
    try {
      const indexScene = sceneGraph.getAncestor(this, IndexScene);
      const serviceScene = sceneGraph.findObject(indexScene, (obj) => obj instanceof ServiceScene) as ServiceScene | null;
      
      if (!serviceScene) {
        window.console.log('[LayerNameSelector] onActivate: ServiceScene not found');
        return;
      }

      // Get labelName and labelValue from URL params
      const { labelName, labelValue } = getRouteParams(serviceScene);
      
      if (labelName && labelValue) {
        window.console.log('[LayerNameSelector] Querying for layers in', labelName, '=', labelValue);
        this.queryLayers(labelName, labelValue);
      } else {
        window.console.log('[LayerNameSelector] No labelName/labelValue in URL:', labelName, labelValue);
      }
    } catch (error) {
      // Not in a ServiceScene context, do nothing
      window.console.log('[LayerNameSelector] onActivate: Error finding ServiceScene:', error);
      return;
    }
  }

  private async queryLayers(labelName: string, labelValue: string) {
    // Convert UI label name to actual Loki label name
    // The URL uses "stack" but Loki uses "namespace"
    const actualLabelName = labelName === SERVICE_UI_LABEL ? SERVICE_NAME : labelName;
    
    // TODO: Make this configurable - might be 'layer', 'layer_id', 'app', etc.
    const layerLabelName = 'layer_name';
    
    window.console.log('[LayerNameSelector] Querying for', layerLabelName, 'values with', actualLabelName, '=', labelValue);
    
    this.setState({ isLoading: true });

    try {
      // Get the datasource
      const dsVariable = getDataSourceVariable(this);
      const datasourceUnknown = await getDataSourceSrv().get(dsVariable.state.value as string);
      
      if (!(datasourceUnknown instanceof DataSourceWithBackend)) {
        logger.error(new Error('[LayerNameSelector] Invalid datasource!'));
        this.setState({ isLoading: false });
        return;
      }

      const datasource = datasourceUnknown as LokiDatasource;

      if (!datasource.getTagValues) {
        logger.error(new Error('[LayerNameSelector] Datasource does not support getTagValues'));
        this.setState({ isLoading: false });
        return;
      }

      // Query for layer_name values filtered by the namespace
      // filters should be an array of filter objects, not a string
      const queryOptions = {
        key: layerLabelName,
        filters: [
          {
            key: actualLabelName,
            operator: '=',
            value: labelValue,
          },
        ],
      };
      
      window.console.log('[LayerNameSelector] Query options:', queryOptions);
      const results = await datasource.getTagValues(queryOptions);

      window.console.log('[LayerNameSelector] Got results:', results);
      window.console.log('[LayerNameSelector] Results type:', typeof results, 'Is array:', Array.isArray(results));

      if (Array.isArray(results)) {
        const options: Array<SelectableValue<string>> = [
          { label: 'All layers', value: '' },
          ...results.map((r) => ({
            label: r.text || r.value || String(r),
            value: r.value || r.text || String(r),
          })),
        ];
        this.setState({ layerOptions: options, isLoading: false });
      } else {
        this.setState({ layerOptions: [{ label: 'All layers', value: '' }], isLoading: false });
      }
    } catch (error) {
      logger.error(error, { msg: '[LayerNameSelector] Error querying for layers' });
      window.console.error('[LayerNameSelector] Error:', error);
      this.setState({ layerOptions: [{ label: 'All layers', value: '' }], isLoading: false });
    }
  }

  onLayerChange(layerValue: string) {
    this.setState({ selectedLayer: layerValue });

    // Check if we're in a ServiceScene context
    // ServiceScene is a sibling, not ancestor, so we need to find it from IndexScene
    try {
      const indexScene = sceneGraph.getAncestor(this, IndexScene);
      const serviceScene = sceneGraph.findObject(indexScene, (obj) => obj instanceof ServiceScene) as ServiceScene | null;
      
      if (!serviceScene) {
        window.console.log('[LayerNameSelector] onLayerChange: ServiceScene not found');
        return;
      }

      const labelsVar = getLabelsVariable(serviceScene);
      
      const currentFilters = labelsVar.state.filters.filter(f => f.key !== 'layer_name');
      
      if (layerValue) {
        currentFilters.push({
          key: 'layer_name',
          operator: '=',
          value: layerValue,
        });
      }

      labelsVar.setState({ filters: currentFilters });
    } catch (error) {
      // Not in a ServiceScene context, do nothing
      window.console.log('[LayerNameSelector] onLayerChange: Error finding ServiceScene:', error);
      return;
    }
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    field: css({
      marginBottom: 0,
    }),
  };
}

