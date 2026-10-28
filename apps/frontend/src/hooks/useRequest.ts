import { useState } from "react";

export function useRequest<Args extends unknown[], Result>(
  request: (...args: Args) => Promise<Result>,
  { onSuccess }: { onSuccess?: (result: Result) => void } = {},
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(...args: Args) {
    setIsLoading(true);
    setError(null);
    try {
      onSuccess?.(await request(...args));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return { send, isLoading, error };
}
