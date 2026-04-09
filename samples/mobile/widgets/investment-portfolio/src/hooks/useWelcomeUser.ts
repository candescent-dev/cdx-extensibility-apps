import { useMemo } from 'react';
import { PlatformSDK } from '@cdx-extensions/di-sdk';

interface WelcomeUserState {
  userName: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useWelcomeUser(): WelcomeUserState {
  const sdk = useMemo(() => PlatformSDK.getInstance(), []);
  const userContextResult: any = sdk.useUserContext();
  const data = userContextResult?.data;
  const isLoading = Boolean(userContextResult?.isLoading);
  const hasError = Boolean(userContextResult?.hasError ?? userContextResult?.error);

  const userName: string | null = data?.fullName ?? data?.fullName ?? 'NA';
  const error: string | null = hasError ? 'Failed to fetch user data' : null;

  return { userName, isLoading, error };
}
