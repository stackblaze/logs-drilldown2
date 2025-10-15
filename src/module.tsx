import { lazy } from 'react';

import { AppPlugin } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';

import pluginJson from 'plugin.json';
import {
  SuspendedEmbeddedLogsExploration,
  SuspendedOpenInLogsDrilldownButton,
} from 'services/extensions/exposedComponents';
import { linkConfigs } from 'services/extensions/links';

// Anything imported in this file is included in the main bundle which is pre-loaded in Grafana
// Don't add imports to this file without lazy loading
// Link extensions are the exception as they must be included in the main bundle in order to work in core Grafana
const App = lazy(async () => {
  // Initialize i18n before loading any components
  await initPluginTranslations(pluginJson.id);

  const { wasmSupported } = await import('services/sorting');

  const { default: initRuntimeDs } = await import('services/datasource');
  const { default: initChangepoint } = await import('@bsull/augurs/changepoint');
  const { default: initOutlier } = await import('@bsull/augurs/outlier');

  initRuntimeDs();

  if (wasmSupported()) {
    await Promise.all([initChangepoint(), initOutlier()]);
  }

  return import('Components/App');
});

const AppConfig = lazy(async () => {
  return await import('./Components/AppConfig/AppConfig');
});

export const plugin = new AppPlugin<{}>().setRootPage(App).addConfigPage({
  body: AppConfig,
  icon: 'cog',
  id: 'configuration',
  title: 'Configuration',
});

for (const linkConfig of linkConfigs) {
  plugin.addLink(linkConfig);
}

plugin.exposeComponent({
  component: SuspendedOpenInLogsDrilldownButton,
  description: 'A button that opens a logs view in Stackblaze Logs.',
  id: `stackblaze-logs-app/open-in-explore-logs-button/v1`,
  title: 'Open in Stackblaze Logs button',
});

plugin.exposeComponent({
  component: SuspendedEmbeddedLogsExploration,
  description: 'A component that renders a logs exploration view that can be embedded in other parts of Grafana.',
  id: `stackblaze-logs-app/embedded-logs-exploration/v1`,
  title: 'Embedded Logs Exploration',
});
