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

  const clearAll = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (expireTimer.current) clearTimeout(expireTimer.current);
    if (tickTimer.current) clearInterval(tickTimer.current);
  }, []);

  const reset = useCallback(() => {
    clearAll();
    setWarning(false);
    setSecondsLeft(60);
    if (!enabled) return;
    idleTimer.current = setTimeout(() => {
      setWarning(true);
      setSecondsLeft(60);
      tickTimer.current = setInterval(() => {
        setSecondsLeft((s) => Math.max(0, s - 1));
      }, 1000);
      expireTimer.current = setTimeout(() => {
        clearAll();
        setWarning(false);
        onExpire();
      }, WARNING_MS);
    }, IDLE_MS);
  }, [enabled, onExpire, clearAll]);

  useEffect(() => {
    if (!enabled) {
      clearAll();
      return;
    }
    reset();
    const handler = () => {
      if (!warning) reset();
    };
    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const continueSession = useCallback(() => {
    reset();
  }, [reset]);

  return { warning, secondsLeft, continueSession };
};
