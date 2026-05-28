import * as React from 'react';
import { PlatformSDK } from '@cdx-extensions/di-sdk';

function firstNameFromFullName(fullName: string | undefined | null): string {
  if (!fullName || fullName === 'NA') return 'there';
  const parts = fullName.trim().split(/\s+/);
  return parts[0] ?? 'there';
}

function greetingPrefix(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Time-of-day greeting using PlatformSDK user context (same harness as widgets).
 */
export function useSandboxGreeting(): { greetingLine: string; isLoading: boolean } {
  const sdk = React.useMemo(() => PlatformSDK.getInstance(), []);
  const userContextResult = sdk.useUserContext() as {
    data?: { fullName?: string };
    isLoading?: boolean;
  };
  const fullName = userContextResult?.data?.fullName;
  const isLoading = Boolean(userContextResult?.isLoading);
  const first = firstNameFromFullName(fullName);
  const line = `${greetingPrefix()}, ${first}`;
  return { greetingLine: line, isLoading };
}
