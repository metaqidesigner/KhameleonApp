import { createPortal } from 'react-dom';
import { KhameleonOrb } from './KhameleonOrb';

export function KhameleonOrbPortal() {
  return createPortal(<KhameleonOrb />, document.body);
}
