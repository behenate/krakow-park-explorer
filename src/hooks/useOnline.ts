import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

/** Connectivity state — drives the offline banner and disables transit routing. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        if (mounted) setOnline(!!state.isConnected && state.isInternetReachable !== false);
      } catch {
        if (mounted) setOnline(true); // fail open
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return online;
}
