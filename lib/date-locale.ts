import { enUS } from "date-fns/locale/en-US"
import { ro } from "date-fns/locale/ro"
import type { Locale } from "date-fns"
import type { Language } from "@/lib/i18n"

const localeMap: Record<Language, Locale> = { en: enUS, ro: ro }

export function getDateLocale(language: Language): Locale {
  return localeMap[language] || enUS
}
