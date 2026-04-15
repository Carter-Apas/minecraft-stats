import { useEffect, useState } from "react";

import type { PlayerDetail, PlayersResponse, SummaryResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function requestJson<T>(pathname: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${pathname}`);
  if (!response.ok) {
    throw new ApiError(`Request failed for ${pathname}`, response.status);
  }
  return response.json() as Promise<T>;
}

export function useSummary() {
  return useApiResource<SummaryResponse>("/summary");
}

export function usePlayers() {
  return useApiResource<PlayersResponse>("/players");
}

export function usePlayer(uuid: string | undefined) {
  return useApiResource<PlayerDetail>(uuid ? `/players/${uuid}` : null);
}

function useApiResource<T>(pathname: string | null) {
  const [state, setState] = useState<{
    data: T | null;
    error: string | null;
    loading: boolean;
  }>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (!pathname) {
      setState({
        data: null,
        error: "Missing resource path",
        loading: false,
      });
      return;
    }

    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: null }));

    requestJson<T>(pathname)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setState({
            data: null,
            error: error instanceof Error ? error.message : "Unknown error",
            loading: false,
          });
        }
      });

    return () => controller.abort();
  }, [pathname]);

  return state;
}

