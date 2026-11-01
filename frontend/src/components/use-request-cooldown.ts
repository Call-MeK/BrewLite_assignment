'use client';

import { useCallback, useEffect, useState } from 'react';
import { cooldownRemaining, startRequestCooldown } from '@/lib/request-cooldown';

export function useRequestCooldown(method: string, endpoint: string) {
  const [seconds, setSeconds] = useState(0);
  const active = seconds > 0;
  useEffect(() => {
    const update = () => setSeconds(cooldownRemaining(method, endpoint));
    update();
    const timer = active ? window.setInterval(update, 250) : null;
    window.addEventListener('request-cooldown-changed', update);
    window.addEventListener('auth-changed', update);
    if (timer !== null && cooldownRemaining(method, endpoint) === 0) update();
    return () => {
      if (timer !== null) window.clearInterval(timer);
      window.removeEventListener('request-cooldown-changed', update);
      window.removeEventListener('auth-changed', update);
    };
  }, [method, endpoint, active]);
  const start = useCallback(() => startRequestCooldown(method, endpoint), [method, endpoint]);
  return { seconds, blocked: seconds > 0, start, label: seconds > 0 ? `Chờ ${seconds}s` : '' };
}
