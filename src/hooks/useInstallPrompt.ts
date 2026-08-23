/**
 * The browser's install offer, if there is one (ADR-029).
 *
 * `beforeinstallprompt` arrives once, unpredictably, and can only be fired in response to a
 * gesture — so it is caught and held until someone presses the button.
 */
import { useCallback, useEffect, useState } from 'react';
import { installAffordance, isIos, type InstallAffordance } from '../lib/install';

/** The event Chrome fires. Not in lib.dom, since it is not a standard. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Whether the page is running as an installed app rather than in a browser tab. */
function standaloneNow(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

export interface InstallController {
  affordance: InstallAffordance;
  install(): void;
}

export function useInstallPrompt(): InstallController {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(standaloneNow);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Without this the browser may show its own UI, or none at all; either way the page loses
      // the ability to choose the moment.
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
      setStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = useCallback(() => {
    if (!prompt) return;
    void prompt.prompt();
    // The offer is single-use: whichever way it goes, this event cannot be fired again.
    void prompt.userChoice.finally(() => setPrompt(null));
  }, [prompt]);

  return {
    affordance: installAffordance({
      standalone,
      promptAvailable: prompt !== null,
      ios: isIos(typeof navigator === 'undefined' ? '' : navigator.userAgent),
    }),
    install,
  };
}
