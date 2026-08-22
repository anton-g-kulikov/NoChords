/**
 * Per-device preferences, persisted on every change (ADR-016).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSettingsStore, type Settings } from '../lib/settings';

export interface SettingsController {
  settings: Settings;
  update(patch: Partial<Settings>): void;
}

export function useSettings(): SettingsController {
  const store = useMemo(() => createSettingsStore(), []);
  const [settings, setSettings] = useState<Settings>(() => store.load());

  // Skip the write that would otherwise fire immediately after the initial load.
  const loaded = useRef(false);
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    store.save(settings);
  }, [settings, store]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  return { settings, update };
}
