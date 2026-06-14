import { createPortal } from 'react-dom';
import { JarvisOrb } from './JarvisOrb';

export function JarvisOrbPortal() {
  return createPortal(<JarvisOrb />, document.body);
}
