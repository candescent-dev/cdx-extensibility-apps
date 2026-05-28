import * as React from 'react';
import {
  PlaceholderFeatureScreen,
  type PlaceholderFeatureScreenProps,
} from '../screens/PlaceholderFeatureScreen';
import { AgentChatBody } from '../screens/AgentScreen';
import type { FeatureRegistryItem } from './types';

type PassThroughProps = Pick<
  PlaceholderFeatureScreenProps,
  'materialIcon' | 'ctaLabel' | 'onCta' | 'fiDeveloperMessage'
>;

const placeholderBody = (feature: string) =>
  `This is a placeholder for the ${feature} feature.`;

/** More menu list items (no `navigateToTab`) render via `FeatureDetailScreen` from this registry. */
const fiDevMoreListHint = (feature: string) =>
  `Replace this screen by swapping the ${feature} component in \`registry/FEATURE_REGISTRY.tsx\`.`;

/** Bottom-tab placeholders render via `TransfersTabScreen` / `PaymentsTabScreen` in tabs.tsx. */
const fiDevBottomTabHint = (feature: string) =>
  `Replace this screen by swapping the ${feature} component in \`navigation/tabs.tsx\`.`;

function QuickActionScreen(props: PassThroughProps) {
  return (
    <PlaceholderFeatureScreen
      title="Quick Action"
      body={placeholderBody('Quick Action')}
      fiDeveloperMessage={fiDevMoreListHint('Quick Action')}
      {...props}
    />
  );
}

function FeedScreen(props: PassThroughProps) {
  return (
    <PlaceholderFeatureScreen
      title="Feed"
      body={placeholderBody('Feed')}
      fiDeveloperMessage={fiDevMoreListHint('Feed')}
      {...props}
    />
  );
}

function OnlineStatementsScreen(props: PassThroughProps) {
  return (
    <PlaceholderFeatureScreen
      title="Online Statements"
      body={placeholderBody('Online Statements')}
      fiDeveloperMessage={fiDevMoreListHint('Online Statements')}
      {...props}
    />
  );
}

function HelpScreen(props: PassThroughProps) {
  return (
    <PlaceholderFeatureScreen
      title="Help & Support"
      body={placeholderBody('Help & Support')}
      fiDeveloperMessage={fiDevMoreListHint('Help & Support')}
      {...props}
    />
  );
}

export function TransfersPlaceholderScreen(props: PassThroughProps) {
  return (
    <PlaceholderFeatureScreen
      title="Transfers"
      body={placeholderBody('Transfers')}
      materialIcon="swap-horiz"
      fiDeveloperMessage={fiDevBottomTabHint('Transfers')}
      {...props}
    />
  );
}

export function PaymentsPlaceholderScreen(props: PassThroughProps) {
  return (
    <PlaceholderFeatureScreen
      title="Check Deposit"
      body={placeholderBody('Check Deposit')}
      materialIcon="smart-button"
      fiDeveloperMessage={fiDevBottomTabHint('Check Deposit')}
      {...props}
    />
  );
}

/**
 * Single source of truth for More menu + Add Feature picker.
 *
 * Built-in rows appear in the order listed here. Optional `builtIn: false` entries surface only after
 * "Add Feature" (persisted ids). Rows with `navigateToTab` jump to that bottom tab when tapped from More.
 *
 * Contract for `@cdx-extensions/widget-template-mobile:feature` generator: every entry (incl. the last)
 * MUST end with a trailing comma and the closing `];` MUST stay on its own line. The generator splices
 * a new `builtIn: false` row just before `];`. Each row MUST include `description` for the Add picker.
 */
export const FEATURE_REGISTRY: FeatureRegistryItem[] = [
  {
    id: 'quick-action',
    label: 'Quick Action',
    description: 'Shortcuts for common banking tasks',
    icon: '⏱',
    materialIcon: 'timer',
    builtIn: true,
    isPlaceholder: true,
    component: QuickActionScreen,
  },
  {
    id: 'feed',
    label: 'Feed',
    description: 'Activity and updates in one place',
    icon: '📡',
    materialIcon: 'rss-feed',
    builtIn: true,
    isPlaceholder: true,
    component: FeedScreen,
  },
  {
    id: 'online-statements',
    label: 'Online Statements',
    description: 'View and download your statements',
    icon: '📄',
    materialIcon: 'receipt-long',
    builtIn: true,
    isPlaceholder: true,
    component: OnlineStatementsScreen,
  },
  {
    id: 'transfers',
    label: 'Transfers',
    description: 'Move money between your accounts',
    icon: '↔️',
    materialIcon: 'swap-horiz',
    builtIn: true,
    navigateToTab: 'Transfers',
    component: TransfersPlaceholderScreen,
  },
  {
    id: 'check-deposit',
    label: 'Check Deposit',
    description: 'Deposit checks from your phone',
    icon: '📸',
    materialIcon: 'smart-button',
    builtIn: true,
    navigateToTab: 'Payments',
    component: PaymentsPlaceholderScreen,
  },
  {
    id: 'help',
    label: 'Help & Support',
    description: 'Get answers and contact support',
    icon: '❓',
    materialIcon: 'help-outline',
    builtIn: true,
    isPlaceholder: true,
    component: HelpScreen,
  },
  {
    id: 'agent-chat',
    label: 'Agent chat',
    description: 'Chat with your virtual assistant',
    icon: '💬',
    materialIcon: 'auto-awesome',
    builtIn: false,
    navigateToTab: 'AgentChat',
    /** Listed in Add Feature until added; `navigateToTab` opens this tab from More once enabled. */
    component: AgentChatBody,
  },
];

export function getFeatureById(id: string): FeatureRegistryItem | undefined {
  return FEATURE_REGISTRY.find((f) => f.id === id);
}
