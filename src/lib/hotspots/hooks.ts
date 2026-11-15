import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hotspotsApi, hotspotsQueryKeys, type FilterParams } from './api-client';

// ==================== Query Hooks ====================

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: hotspotsApi.health,
    refetchInterval: 30000,
    staleTime: 10000,
  });
}

export function useHotspots(params: FilterParams = {}) {
  return useQuery({
    queryKey: hotspotsQueryKeys.list(params),
    queryFn: () => hotspotsApi.getHotspots(params),
    enabled: !!params.dateFrom || !!params.dateTo || Object.keys(params).length > 0,
    staleTime: 30000,
  });
}

export function useHotspotsArray(params: Omit<FilterParams, 'format'> = {}) {
  return useQuery({
    queryKey: hotspotsQueryKeys.list({ ...params, format: 'array' }),
    queryFn: () => hotspotsApi.getHotspotsArray(params),
    staleTime: 30000,
  });
}

export function useHotspotsGeoJSON(params: Omit<FilterParams, 'format'> = {}) {
  return useQuery({
    queryKey: hotspotsQueryKeys.geoJSON(params),
    queryFn: () => hotspotsApi.getHotspotsGeoJSON(params),
    staleTime: 30000,
  });
}

export function useHotspotsStats(params: FilterParams = {}) {
  return useQuery({
    queryKey: hotspotsQueryKeys.stats(params),
    queryFn: () => hotspotsApi.getStats(params),
    staleTime: 30000,
  });
}

export function useTimeSeries(params: FilterParams = {}) {
  return useQuery({
    queryKey: hotspotsQueryKeys.timeSeries(params),
    queryFn: () => hotspotsApi.getTimeSeries(params),
    staleTime: 30000,
  });
}

export function useWatchpoints() {
  return useQuery({
    queryKey: hotspotsQueryKeys.watchpoints,
    queryFn: hotspotsApi.getWatchpoints,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ==================== Mutation Hooks ====================

export function useLoadHotspots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (csv: string) => hotspotsApi.loadCsv(csv),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hotspotsQueryKeys.all });
    },
  });
}

export function useLoadHotspotsAsync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ csv, batchSize }: { csv: string; batchSize?: number }) =>
      hotspotsApi.loadCsvAsync(csv, batchSize),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hotspotsQueryKeys.all });
    },
  });
}

export function useDownloadAndLoad() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      minLat: number;
      maxLat: number;
      minLon: number;
      maxLon: number;
      startDate: string;
      endDate: string;
      source?: string;
    }) => hotspotsApi.downloadAndLoad(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hotspotsQueryKeys.all });
    },
  });
}

export function useClearHotspots() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: hotspotsApi.clear,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hotspotsQueryKeys.all });
    },
  });
}

// ==================== Type Helpers ====================

export type UseHotspotsResult = ReturnType<typeof useHotspots>;
export type UseHotspotsArrayResult = ReturnType<typeof useHotspotsArray>;
export type UseHotspotsGeoJSONResult = ReturnType<typeof useHotspotsGeoJSON>;
export type UseHotspotsStatsResult = ReturnType<typeof useHotspotsStats>;
export type UseTimeSeriesResult = ReturnType<typeof useTimeSeries>;
export type UseWatchpointsResult = ReturnType<typeof useWatchpoints>;
export type UseLoadHotspotsResult = ReturnType<typeof useLoadHotspots>;
export type UseLoadHotspotsAsyncResult = ReturnType<typeof useLoadHotspotsAsync>;
export type UseDownloadAndLoadResult = ReturnType<typeof useDownloadAndLoad>;
export type UseClearHotspotsResult = ReturnType<typeof useClearHotspots>;