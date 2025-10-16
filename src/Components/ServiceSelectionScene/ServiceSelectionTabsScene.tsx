import React, { useRef } from 'react';

import { css, cx } from '@emotion/css';
import { rest } from 'lodash';

import { GrafanaTheme2, LoadingState, SelectableValue } from '@grafana/data';
import { SceneComponentProps, sceneGraph, SceneObjectBase, SceneObjectState, SceneQueryRunner } from '@grafana/scenes';
import { Icon, Popover, PopoverController, Tab, TabsBar, Tooltip, useStyles2 } from '@grafana/ui';

import { getSceneQueryRunner } from '../../services/panel';
import { buildResourceQuery } from '../../services/query';
import { getFavoriteTabsFromStorage, removeTabFromLocalStorage } from '../../services/store';
import { truncateText } from '../../services/text';
import { getDataSourceVariable, getServiceSelectionPrimaryLabel } from '../../services/variableGetters';
import { SERVICE_NAME, SERVICE_UI_LABEL } from '../../services/variables';
import { ServiceSelectionScene } from './ServiceSelectionScene';
import { TabPopoverScene } from './TabPopoverScene';

export interface TabOption extends SelectableValue<string> {
  active?: boolean;
  label: string;
  saved?: boolean;
  savedIndex?: number;
  value: string;
}

export interface ServiceSelectionTabsSceneState extends SceneObjectState {
  $labelsData: SceneQueryRunner;
  popover?: TabPopoverScene;
  showPopover: boolean;
  tabOptions: TabOption[];
}

interface LabelOptions {
  cardinality: number;
  label: string;
}

export class ServiceSelectionTabsScene extends SceneObjectBase<ServiceSelectionTabsSceneState> {
  constructor(state: Partial<ServiceSelectionTabsSceneState>) {
    super({
      $labelsData: getSceneQueryRunner({
        queries: [buildResourceQuery('', 'detected_labels')],
        runQueriesMode: 'manual',
      }),
      showPopover: false,
      tabOptions: [
        {
          label: SERVICE_UI_LABEL,
          saved: true,
          value: SERVICE_NAME,
        },
      ],
      ...state,
    });

    this.addActivationHandler(this.onActivate.bind(this));
  }

  public static Component = ({ model }: SceneComponentProps<ServiceSelectionTabsScene>) => {
    // Scene vars
    const { $labelsData, popover, showPopover, tabOptions } = model.useState();
    const { data } = $labelsData.useState();
    const serviceSelectionScene = sceneGraph.getAncestor(model, ServiceSelectionScene);
    const primaryLabel = getServiceSelectionPrimaryLabel(model);
    // Re-render when active tab changes, which is stored in the primary label variable
    primaryLabel.useState();

    // Constants
    const styles = useStyles2(getTabsStyles);
    const popoverRef = useRef<HTMLElement>(null);
    const maxLabelLength = 15;

    return (
      <TabsBar className={styles.tabs}>
        {tabOptions
          .filter((tabLabel) => tabLabel.value === SERVICE_NAME)
          .sort((a, b) => {
            // Service name goes first
            if (a.value === SERVICE_NAME || b.value === SERVICE_NAME) {
              return a.value === SERVICE_NAME ? -1 : 1;
            }

            // Then sort by the order added to local storage
            return (a.savedIndex ?? 0) - (b.savedIndex ?? 0);
          })
          .map((tabLabel) => {
            const tab = (
              <Tab
                key={tabLabel.value}
                onChangeTab={() => {
                  // Set the new active tab
                  serviceSelectionScene.setSelectedTab(tabLabel.value);
                }}
                label={truncateText(tabLabel.label, maxLabelLength, true)}
                active={tabLabel.active}
              />
            );

            if (tabLabel.label.length > maxLabelLength) {
              return (
                <Tooltip key={tabLabel.value} content={tabLabel.label}>
                  {tab}
                </Tooltip>
              );
            } else {
              return tab;
            }
          })}
        {data?.state === LoadingState.Loading && <Tab label={'Loading tabs'} icon={'spinner'} />}

        {popover && (
          <PopoverController content={<popover.Component model={popover} />}>
            {(showPopper, hidePopper, popperProps) => {
              const blurFocusProps = {
                onBlur: hidePopper,
                onFocus: showPopper,
              };

              return (
                <>
                  {popoverRef.current && (
                    <>
                      <Popover
                        {...popperProps}
                        {...rest}
                        show={showPopover}
                        wrapperClassName={styles.popover}
                        referenceElement={popoverRef.current}
                        renderArrow={true}
                        {...blurFocusProps}
                      />
                    </>
                  )}
                </>
              );
            }}
          </PopoverController>
        )}
      </TabsBar>
    );
  };

  removeSavedTab = (labelName: string) => {
    removeTabFromLocalStorage(getDataSourceVariable(this).getValue().toString(), labelName);

    const labels = this.getLabelsFromQueryRunnerState();
    if (labels) {
      this.populatePrimaryLabelsVariableOptions(labels);
    }

    // If the user is closing the active tab, select the default tab
    const serviceSelectionScene = sceneGraph.getAncestor(this, ServiceSelectionScene);
    if (serviceSelectionScene.getSelectedTab() === labelName) {
      serviceSelectionScene.selectDefaultLabelTab();
    }
  };

  toggleShowPopover = () => {
    this.setState({
      showPopover: !this.state.showPopover,
    });
  };

  getLabelsFromQueryRunnerState(state = this.state.$labelsData?.state): LabelOptions[] | undefined {
    return state.data?.series?.[0]?.fields.map((f) => {
      return {
        cardinality: f.values[0],
        label: f.name,
      };
    });
  }

  public populatePrimaryLabelsVariableOptions(labels: LabelOptions[]) {
    const serviceSelectionScene = sceneGraph.getAncestor(this, ServiceSelectionScene);
    const selectedTab = serviceSelectionScene.getSelectedTab();
    const savedTabs = getFavoriteTabsFromStorage(getDataSourceVariable(this).getValue().toString());

    const tabOptions: TabOption[] = labels
      .map((l) => {
        const savedIndex = savedTabs.indexOf(l.label);
        const option: TabOption = {
          active: selectedTab === l.label,
          label: l.label === SERVICE_NAME ? SERVICE_UI_LABEL : l.label,
          saved: savedIndex !== -1,
          savedIndex,
          value: l.label,
        };
        return option;
      })
      .sort((a, b) => {
        // Sort service first
        if (a.value === SERVICE_NAME || b.value === SERVICE_NAME) {
          return a.value === SERVICE_NAME ? -1 : 1;
        }

        // Then sort alphabetically
        return a.label < b.label ? -1 : a.label > b.label ? 1 : 0;
      });
    this.setState({
      tabOptions,
    });
  }

  private runDetectedLabels() {
    this.state.$labelsData.runQueries();
  }

  private runDetectedLabelsSubs() {
    // Update labels/tabs on time range change
    this._subs.add(
      sceneGraph.getTimeRange(this).subscribeToState(() => {
        this.runDetectedLabels();
      })
    );

    // Update labels (tabs) when datasource is changed
    this._subs.add(
      getDataSourceVariable(this).subscribeToState(() => {
        this.runDetectedLabels();
      })
    );
  }

  private onActivate() {
    // Get labels
    this.runDetectedLabels();

    this.setState({
      popover: new TabPopoverScene({}),
    });

    this.runDetectedLabelsSubs();

    // Update labels (tabs) when datasource is changed
    this._subs.add(
      getDataSourceVariable(this).subscribeToState(() => {
        this.state.$labelsData.runQueries();
      })
    );

    this._subs.add(
      getServiceSelectionPrimaryLabel(this).subscribeToState(() => {
        const labels = this.getLabelsFromQueryRunnerState(this.state.$labelsData?.state);
        if (labels) {
          this.populatePrimaryLabelsVariableOptions(labels);
        }
      })
    );

    this._subs.add(
      this.state.$labelsData.subscribeToState((newState) => {
        if (newState.data?.state === LoadingState.Done) {
          const labels = this.getLabelsFromQueryRunnerState(newState);
          const serviceSelectionScene = sceneGraph.getAncestor(this, ServiceSelectionScene);

          if (labels) {
            this.populatePrimaryLabelsVariableOptions(labels);
          }

          const selectedTab = serviceSelectionScene.getSelectedTab();
          // If the tab is no longer available, either because the user changed the datasource, or time range, select the default tab
          if (!labels?.some((label) => label.label === selectedTab)) {
            serviceSelectionScene.selectDefaultLabelTab();
          }
        }
      })
    );
  }
}

const getTabsStyles = (theme: GrafanaTheme2) => ({
  addTab: css({
    '& button': {
      color: theme.colors.primary.text,
    },
    color: theme.colors.primary.text,
    label: 'add-label-tab',
  }),
  popover: css({
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
  }),
  tabs: css({
    overflowY: 'hidden',
  }),
});
