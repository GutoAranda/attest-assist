// 30-minute inactivity timeout with a 60s warning dialog.
import { useEffect, useState, useCallback, useRef } from 'react';

const IDLE_MS = 30 * 60 * 1000; // 30 min
const WARNING_MS = 60 * 1000; // 60s before logout

export const useSessionTimeout = (onExpire: () => void, enabled: boolean) => {
  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const idleTimer = useRef<ReturnType<typeof setTimeout>>();
  const expireTimer = useRef<ReturnType<typeof setTimeout>>();
  const tickTimer = useRef<ReturnType<typeof setInterval>>();
  const warningRef = useRef(false);
  // Hold latest onExpire in a ref so a stale closure doesn't fire an obsolete callback.
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  const clearAll = useCallback(() => {
    if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = undefined; }
    if (expireTimer.current) { clearTimeout(expireTimer.current); expireTimer.current = undefined; }
    if (tickTimer.current) { clearInterval(tickTimer.current); tickTimer.current = undefined; }
  }, []);

  const reset = useCallback(() => {
    clearAll();
    warningRef.current = false;
    setWarning(false);
    setSecondsLeft(60);
    if (!enabled) return;
    idleTimer.current = setTimeout(() => {
      warningRef.current = true;
      setWarning(true);
      setSecondsLeft(60);
      tickTimer.current = setInterval(() => {
        setSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);
      expireTimer.current = setTimeout(() => {
        clearAll();
        warningRef.current = false;
        setWarning(false);
        onExpireRef.current();
      }, WARNING_MS);
    }, IDLE_MS);
  }, [enabled, clearAll]);

  useEffect(() => {
    if (!enabled) {
      clearAll();
      return;
    }
    reset();
    const handler = () => {
      if (!warningRef.current) reset();
    };
    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearAll();
    };
  }, [enabled, reset, clearAll]);

  const continueSession = useCallback(() => {
    reset();
  }, [reset]);

  return { warning, secondsLeft, continueSession };
};
