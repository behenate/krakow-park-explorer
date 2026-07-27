import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Foreground, in-session location — used for "nearby" features and route start. */
export function useUserLocation(): LatLng | null {
  const [loc, setLoc] = useState<LatLng | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) return;
        const last = await Location.getLastKnownPositionAsync();
        if (mounted && last) setLoc({ lat: last.coords.latitude, lng: last.coords.longitude });
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (mounted) setLoc({ lat: cur.coords.latitude, lng: cur.coords.longitude });
      } catch {
        // location unavailable — features degrade gracefully
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return loc;
}
