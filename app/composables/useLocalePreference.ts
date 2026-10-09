import type { DropdownMenuItem } from '@nuxt/ui'
import {
  defaultLocale,
  isAppLocaleCode,
  localeCookieKey,
  legacyLocaleCookieKey,
  locales,
  type AppLocaleCode,
} from '~~/i18n/i18n.options'

export type LocalePreference = AppLocaleCode | 'auto'

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365

/**
 * The UI language preference, picked from the dashboard account menu.
 * It only affects the current browser, never the instance settings.
 *
 * An explicit choice is stored in the project locale cookie, which the
 * i18n detection reads first on every request. `auto` clears the cookie.
 */
export function useLocalePreference() {
  const { $i18n } = useNuxtApp()

  const cookieOptions = {
    maxAge: ONE_YEAR_IN_SECONDS,
    sameSite: 'lax',
    path: '/',
  } as const
  const cookie = useCookie<string | null>(localeCookieKey, cookieOptions)
  const legacyCookie = useCookie<string | null>(
    legacyLocaleCookieKey,
    cookieOptions,
  )

  if (!cookie.value && isAppLocaleCode(legacyCookie.value)) {
    cookie.value = legacyCookie.value
  }
  if (legacyCookie.value) {
    legacyCookie.value = null
  }

  const preference = useState<LocalePreference>('locale-preference', () =>
    isAppLocaleCode(cookie.value) ? cookie.value : 'auto',
  )

  const resolveLocale = (value: LocalePreference): AppLocaleCode => {
    if (value !== 'auto') {
      return value
    }
    const browserLocale = $i18n.getBrowserLocale()
    return isAppLocaleCode(browserLocale) ? browserLocale : defaultLocale
  }

  const setPreference = async (value: LocalePreference) => {
    preference.value = value
    cookie.value = value === 'auto' ? null : value
    await $i18n.setLocale(resolveLocale(value))
  }

  const menuItems = computed<DropdownMenuItem[][]>(() => [
    [
      {
        label: $i18n.t('ui.locale.auto'),
        icon: 'tabler:world',
        type: 'checkbox',
        checked: preference.value === 'auto',
        onSelect: () => setPreference('auto'),
      },
    ],
    locales.map(({ code, label }) => ({
      label,
      type: 'checkbox',
      checked: preference.value === code,
      onSelect: () => setPreference(code),
    })),
  ])

  return { menuItems }
}
