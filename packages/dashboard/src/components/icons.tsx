/** Zero-dependency inline SVG icons (16px, stroke = currentColor).
 *  Sized by CSS via .nav-item svg / .module-icon svg. */
export type IconName =
  | 'overview'
  | 'employees'
  | 'run'
  | 'approvals'
  | 'audit'
  | 'growth'
  | 'policy'
  | 'product'
  | 'console'
  | 'builder'
  | 'loop'
  | 'routing'
  | 'enterprise'
  | 'crm'
  | 'sales'
  | 'analytics'
  | 'integrations';

const PATHS: Record<IconName, string> = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  employees: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  run: 'M6 4l14 8-14 8z',
  approvals: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3',
  audit: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  growth: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
  policy: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  product: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  console: 'M4 17l6-6-6-6M12 19h8',
  builder: 'M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5zM2 2l7.586 7.586M11 11a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  loop: 'M17 1l4 4-4 4M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 0 1-4 4H3',
  routing: 'M6 3v12a3 3 0 0 0 3 3h6M18 21l3-3-3-3M6 3a3 3 0 1 0 0 .01',
  enterprise: 'M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 9h.01M15 9h.01M9 13h.01M15 13h.01',
  crm: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6',
  sales: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  analytics: 'M18 20V10M12 20V4M6 20v-6',
  integrations: 'M9 7V3m0 4h4M9 7a4 4 0 1 0 0 8v6m0-6H7m10 4v4m0-4a4 4 0 1 0 0-8V3m0 8h2',
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
