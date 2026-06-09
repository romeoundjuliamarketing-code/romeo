import { useState, useCallback } from 'react';

export function useCaptcha(): {
  captchaToken: string | null;
  setCaptchaToken: (token: string | null) => void;
  captchaKey: number;
  resetCaptcha: () => void;
} {
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);

  // Clears the stored token and remounts the widget (single-use tokens).
  const resetCaptcha = useCallback(() => {
    setCaptchaToken(null);
    setCaptchaKey(k => k + 1);
  }, []);

  return { captchaToken, setCaptchaToken, captchaKey, resetCaptcha };
}
