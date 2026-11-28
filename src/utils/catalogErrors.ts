import { CatalogError } from '../services/publicApis';
import type { TranslationKey } from '../services/i18n';

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** Turn a failed catalog search into advice the student can act on. */
export function describeCatalogError(err: unknown, source: string, fallback: TranslationKey, t: Translate): string {
  if (!(err instanceof CatalogError)) return t(fallback);
  if (err.code === 'query_too_short') return t('openlib_err_too_short');
  if (err.code === 'query_not_allowed') return t('openlib_err_not_allowed');
  if (err.code === 'rate_limited' || err.code === 'upstream_busy') return t('catalog_err_busy', { source });
  if (err.code === 'timeout') return t('catalog_err_timeout', { source });
  return t('catalog_err_upstream', { source, status: err.status ?? '' });
}
