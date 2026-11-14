/** Magen's mark (L7): an M, the classical lock, stacked on a chevron, the quantum-safe lock. Two locks, one shield. */
export function Mark({ size = 30 }: { size?: number; glow?: boolean }) {
  return <svg width={Math.round(size * .885)} height={size} viewBox="-6 -6 255 288" fill="none" aria-hidden="true" style={{ flex: 'none' }}>
    <path d="M0 0 L121.5 70 L243 0 L243 127 L208 127 L208 84 L121.5 133 L35 84 L35 127 L0 127 Z" fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="10" strokeLinejoin="round" />
    <path d="M0 137 L121.5 209 L243 137 L243 201 L121.5 274 L0 201 Z" fill="#E040C8" stroke="#E040C8" strokeWidth="10" strokeLinejoin="round" />
  </svg>;
}
export const Brand = ({ href = '#/', size = 30 }: { href?: string; size?: number }) =>
  <a className="brand" href={href}><Mark size={size} />magen</a>;
