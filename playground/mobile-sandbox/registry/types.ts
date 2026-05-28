import type * as React from 'react';

/**
 * Props a host typically passes to registry widgets: `httpClient`, `name`, `modalRef`.
 * Optional `scrollable` / `embedded` are sandbox conveniences for nested scroll or legacy shells.
 */
export type ThirdPartyHostProps = {
  httpClient?: unknown;
  name?: string;
  modalRef?: React.RefObject<unknown | null> | null;
  scrollable?: boolean;
  embedded?: boolean;
};

export type WidgetRegistryItem = {
  id: string;
  name: string;
  description: string;
  /** Short label for picker rows (emoji ok for sandbox) */
  icon: string;
  /** Material Icon name used by SandboxMaterialIcon when set (e.g. "pie-chart"). */
  materialIcon?: string;
  component: React.ComponentType<ThirdPartyHostProps>;
};

export type MainTabName =
  | 'Accounts'
  | 'AgentChat'
  | 'Transfers'
  | 'Payments'
  | 'More';

export type FeatureRegistryItem =
  | {
      id: string;
      label: string;
      /** Shown in Add Feature picker subtitle (same role as widget `description`). */
      description: string;
      icon: string;
      /** Material Icon name used by SandboxMaterialIcon (e.g. "timer", "help-outline"). */
      materialIcon?: string;
      builtIn: boolean;
      /** True when the component is a sandbox placeholder awaiting a real implementation. */
      isPlaceholder?: never;
      navigateToTab: MainTabName;
      /** Optional detail screen when opened from More while {@link navigateToTab} targets a tab. */
      component?: React.ComponentType;
    }
  | {
      id: string;
      label: string;
      description: string;
      icon: string;
      materialIcon?: string;
      builtIn: boolean;
      /** True when the component is a sandbox placeholder awaiting a real implementation. */
      isPlaceholder?: boolean;
      navigateToTab?: undefined;
      component: React.ComponentType;
    };
