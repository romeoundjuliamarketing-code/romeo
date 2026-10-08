import { useEffect, useRef, useState } from 'react';
import {
  useStoredSparringDraft, newPublishRequestId,
} from '../../../hooks/useStoredSparringDraft';
import {
  serializeDraft, restoreDraft, type SparringDraft, type StoredDraftData,
} from '../../../utils/sparringDraft';

const SAVE_DEBOUNCE_MS = 500;

// Keeps the unpublished draft on the device while the create flow is open.
// The request id stays the same for every retry of one draft and is renewed
// only after a successful publication or an explicit discard.
export function useCreateDraftStore({ visible, draft, dirty, onLoaded }: {
  visible:  boolean;
  draft:    SparringDraft;
  /** True once the draft differs from its starting point (worth saving). */
  dirty:    boolean;
  /** Called once per opening with the restored draft, or null. */
  onLoaded: (restored: SparringDraft | null) => void;
}): {
  ready:         boolean;
  restoredShown: boolean;
  requestId:     () => string;
  renew:         () => void;
  discard:       () => Promise<void>;
} {
  const { load, save, clear } = useStoredSparringDraft<StoredDraftData>();
  const requestIdRef = useRef<string>(newPublishRequestId());
  const [ready, setReady] = useState(false);
  const [restoredShown, setRestoredShown] = useState(false);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  useEffect(() => {
    if (!visible) {
      setReady(false);
      setRestoredShown(false);
      return;
    }
    let cancelled = false;
    void load().then((stored) => {
      if (cancelled) return;
      const restored = stored !== null ? restoreDraft(stored.draft, new Date()) : null;
      if (stored !== null && restored !== null) requestIdRef.current = stored.requestId;
      onLoadedRef.current(restored);
      setRestoredShown(restored !== null);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [visible, load]);

  useEffect(() => {
    if (!visible || !ready || !dirty) return;
    const timer = setTimeout(() => { void save(serializeDraft(draft), requestIdRef.current); }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [visible, ready, dirty, draft, save]);

  return {
    ready,
    restoredShown,
    requestId: () => requestIdRef.current,
    renew: () => { requestIdRef.current = newPublishRequestId(); },
    discard: async () => {
      requestIdRef.current = newPublishRequestId();
      await clear();
    },
  };
}
