'use client';

import { useLocale } from '@/components/providers/LocaleProvider';
import { translate } from './translations';

/**
 * Hook for translating UI strings.
 * Uses the English text as the key — if no translation exists, the English text is returned.
 *
 * Usage:
 *   const { t } = useTranslation();
 *   <span>{t('Home')}</span>
 *   <span>{t('Connect Wallet')}</span>
 */
export function useTranslation() {
  const { locale } = useLocale();
  return {
    t: (key: string) => translate(locale, key),
    locale,
  };
}
