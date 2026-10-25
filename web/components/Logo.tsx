export function Logo() {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="logo"
      focusable="false"
    >
      <rect x="13" y="3.5" width="6" height="6" rx="1.5" fill="currentColor" />
      <rect
        x="3.5"
        y="22.5"
        width="6"
        height="6"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.4"
      />
      <rect
        x="22.5"
        y="22.5"
        width="6"
        height="6"
        rx="1.5"
        fill="currentColor"
        fillOpacity="0.4"
      />
      <path
        d="M16 9.5 6.5 22.5M16 9.5 25.5 22.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
