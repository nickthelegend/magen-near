import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

export const EASE = [0.2, 0.7, 0.2, 1] as const;

/** Fades and lifts its children in once, when it scrolls into view. */
export function Reveal({ children, delay = 0, y = 26, className, style, as = 'div' }: { children: ReactNode; delay?: number; y?: number; className?: string; style?: any; as?: 'div' | 'section' | 'span' }) {
  const M = (motion as any)[as];
  return <M className={className} style={style} initial={{ opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.65, ease: EASE, delay }}>{children}</M>;
}

/** A container whose direct Item children stagger in. */
export const Stagger = ({ children, className, style, gap = 0.08, inView = true }: { children: ReactNode; className?: string; style?: any; gap?: number; inView?: boolean }) =>
  <motion.div className={className} style={style} initial="hide" {...(inView ? { whileInView: 'show', viewport: { once: true, margin: '-60px' } } : { animate: 'show' })}
    variants={{ hide: {}, show: { transition: { staggerChildren: gap } } }}>{children}</motion.div>;

export const item = { hide: { opacity: 0, y: 22 }, show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } } };
export const Item = ({ children, className, style, ...rest }: HTMLMotionProps<'div'>) => <motion.div className={className} style={style} variants={item} {...rest}>{children}</motion.div>;
