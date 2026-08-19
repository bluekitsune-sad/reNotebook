import { useState, useEffect, useCallback } from 'react';

export function useNetwork() {
  const [isOnline, setIsOnline] = useState(true);

  const checkConnectivity = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      await fetch('https://httpbin.org/status/200', {
        method: 'HEAD',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }
  }, []);

  useEffect(() => {
    let NetInfo;
    try {
      NetInfo = require('@react-native-community/netinfo');
    } catch {
      NetInfo = null;
    }

    if (NetInfo) {
      const unsubscribe = NetInfo.addEventListener((state) => {
        setIsOnline(state.isConnected && state.isInternetReachable !== false);
      });
      return () => unsubscribe();
    }

    checkConnectivity();
    const interval = setInterval(checkConnectivity, 15000);
    return () => clearInterval(interval);
  }, [checkConnectivity]);

  return { isOnline, checkConnectivity };
}
