import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiSource, createDataSource, type FireCalendarDataSource } from "./dataSource";

const Ctx = createContext<FireCalendarDataSource | null>(null);

export function FireCalendarProvider({ children, source }: { children: ReactNode; source?: FireCalendarDataSource }) {
  const [client] = useState(
    () =>
      new QueryClient({
        // data only changes when the model is retrained → cache forever
        defaultOptions: { queries: { staleTime: Infinity, gcTime: 30 * 60_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  const [ds] = useState(() => source ?? createDataSource());
  useEffect(() => {
    if (ds instanceof ApiSource) void ds.health(); // wake the Space early
  }, [ds]);
  return (
    <QueryClientProvider client={client}>
      <Ctx.Provider value={ds}>{children}</Ctx.Provider>
    </QueryClientProvider>
  );
}

export function useDataSource(): FireCalendarDataSource {
  const ds = useContext(Ctx);
  if (!ds) throw new Error("wrap the app in <FireCalendarProvider>");
  return ds;
}
