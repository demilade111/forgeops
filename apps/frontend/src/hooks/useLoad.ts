import { useCallback, useEffect, useState } from "react";

export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(load, deps);

  const reload = useCallback(
    () =>
      run()
        .then((result) => {
          setData(result);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [run],
  );

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, reload };
}
