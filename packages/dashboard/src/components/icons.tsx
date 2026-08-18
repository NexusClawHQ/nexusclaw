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
  | 'console';

const PATHS: Record<IconName, string> = {
  overview: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  employees: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  run: 'M6 4l14 8-14 8z',
  approvals: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3',
  audit: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  growth: 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6',
  policy: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  console: 'M4 17l6-6-6-6M12 19h8',
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
