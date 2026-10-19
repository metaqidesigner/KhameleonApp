import React from 'react';
import { Store } from 'lucide-react';
import KhameleonStubPage from '@/components/KhameleonStubPage';

export default function Marketplace() {
  return <KhameleonStubPage title="MARKETPLACE" icon={<Store size={13}/>} connectors={['Hermes Registry','Plugin Hub','Skill Store']} />;
}
