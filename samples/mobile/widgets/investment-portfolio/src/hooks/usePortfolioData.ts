import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlatformSDK } from '@cdx-extensions/di-sdk';

import type { PortfolioAllocationItem, PortfolioItem } from '../types';
import { config } from '../config';

interface PortfolioDataState {
  data: PortfolioItem[] | null;
  totalValue: number | null;
  refreshKey: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

function pickRandom(
  list: PortfolioAllocationItem[],
  previous?: PortfolioAllocationItem | null,
): PortfolioAllocationItem {
  if (list.length <= 1) return list[0];
  const candidates = previous ? list.filter((item) => item !== previous) : list;
  return candidates[Math.floor(Math.random() * candidates.length)];
}


export function usePortfolioData(): PortfolioDataState {
  const sdk = useMemo(() => PlatformSDK.getInstance(), []);
  const cachedList = useRef<PortfolioAllocationItem[] | null>(null);
  const [selected, setSelected] = useState<PortfolioAllocationItem | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<PortfolioAllocationItem[]> => {
    const client = sdk.getHttpClient();
    const url = `${config.baseUrl.replace(/\/$/, '')}${config.apiPath}`;
    const response = await client.get<PortfolioAllocationItem[]>(url);
    return response.data;
  }, [sdk]);

  const loadFromApi = useCallback(() => {
    setIsLoading(true);
    setError(null);

    fetchData()
      .then((list) => {
        cachedList.current = list;
        if (list.length > 0) {
          setSelected((prev) => pickRandom(list, prev));
        } else {
          setSelected(null);
        }
      })
      .catch((err) => {
        setError(err?.message ?? 'Failed to fetch portfolio data');
        setSelected(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [fetchData]);

  useEffect(() => {
    loadFromApi();
  }, [loadFromApi]);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
    if (cachedList.current && cachedList.current.length > 0) {
      setSelected((prev) => pickRandom(cachedList.current!, prev));
      return;
    }
    loadFromApi();
  }, [loadFromApi]);

  return {
    data: selected?.allocations ?? null,
    totalValue: selected?.totalValue ?? null,
    refreshKey,
    isLoading,
    error,
    refresh,
  };
}
