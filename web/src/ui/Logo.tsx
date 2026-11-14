/** Magen's mark (art-v4): a magenta shield with an M cut out. */
export function Mark({ size = 30 }: { size?: number; glow?: boolean }) {
  return <img src="/v4/magen-logo-512.png" width={size} height={size} alt="" aria-hidden="true" style={{ width: size, height: size, flex: 'none' }} />;
}
export const Brand = ({ href = '#/', size = 30 }: { href?: string; size?: number }) =>
  <a className="brand" href={href}><Mark size={size} />magen</a>;
