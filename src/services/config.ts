import { config } from '@grafana/runtime';

import { JsonData } from '../Components/AppConfig/AppConfig';

export function getPluginConfig(): JsonData {
  const pluginMeta = config.apps['stackblaze-logs-app'];
  return (pluginMeta?.jsonData as JsonData) || {};
}

export function getLayerLabelName(): string {
  const pluginConfig = getPluginConfig();
  return pluginConfig.layerLabelName || 'layer_name';
}

export function getNamespaceFilterPrefix(): string {
  const pluginConfig = getPluginConfig();
  return pluginConfig.namespaceFilterPrefix || 'stackblaze';
}

