export default function DoveIcon({ size = 24, color = "currentColor", strokeWidth = 1.5 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 18c1-3 4-5 7-5 1 0 2 0 3 1 1-3 3-6 6-7 1 2 1 4 0 6-1 1-2 2-4 3-1 0-3 1-4 1-3 1-6 2-8 1z" />
      <path d="M11 13c-1-3-1-6 1-9" />
      <path d="M11 13c-4-2-7-3-9-2" />
    </svg>
  );
}
