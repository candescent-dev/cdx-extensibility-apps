import { PortfolioAllocationScreen } from '@cdx-extensions-examples/investment-portfolio';
import type { WidgetRegistryItem } from './types';

/**
 * Home (Accounts tab) exposes three empty slots that hydrate from this list via `WidgetPickerModal`.
 *
 * Extend with new rows + components; keep `sandbox/metro` path aliases pointing at rebuilt packages when
 * you iterate locally (`samples/mobile/widgets/*`).
 *
 * Contract for `@cdx-extensions/widget-template-mobile:widget` generator: every entry (incl. the last)
 * MUST end with a trailing comma and the closing `];` MUST stay on its own line. The generator splices
 * a new row just before `];`.
 */
export const WIDGET_REGISTRY: WidgetRegistryItem[] = [
  {
    id: 'investment-portfolio',
    name: 'Investment Portfolio',
    description: 'View portfolio allocation breakdown',
    icon: '📊',
    materialIcon: 'pie-chart',
    component: PortfolioAllocationScreen,
  },
];

export function getWidgetById(id: string): WidgetRegistryItem | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id);
}
