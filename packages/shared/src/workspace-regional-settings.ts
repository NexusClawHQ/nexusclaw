export const WORKSPACE_LANGUAGES = [
  'zh-CN', 'zh-TW', 'en-US', 'en-GB', 'ja-JP',
  'ko-KR', 'de-DE', 'fr-FR', 'es-ES', 'pt-BR',
] as const;

export const WORKSPACE_TIMEZONES = [
  'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Taipei', 'Asia/Tokyo',
  'Asia/Seoul', 'Asia/Singapore', 'Asia/Kolkata', 'Europe/London',
  'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Chicago',
  'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
  'Australia/Sydney', 'UTC',
] as const;

export const WORKSPACE_DATE_FORMATS = [
  'YYYY-MM-DD', 'YYYY/MM/DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY年MM月DD日',
] as const;
export const WORKSPACE_TIME_FORMATS = ['24h', '12h'] as const;
export const WORKSPACE_NUMBER_FORMATS = ['comma-dot', 'dot-comma', 'space-comma'] as const;
export const WORKSPACE_CURRENCY_POSITIONS = ['before', 'after'] as const;

export const DEFAULT_WORKSPACE_REGIONAL_SETTINGS = {
  language: 'zh-CN',
  timezone: 'Asia/Shanghai',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '24h',
  numberFormat: 'comma-dot',
  currencyPosition: 'before',
  fiscalYearStartMonth: 1,
} as const;
