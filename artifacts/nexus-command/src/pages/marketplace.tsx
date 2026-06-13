import React from 'react';
import { Store } from 'lucide-react';
import JarvisStubPage from '@/components/JarvisStubPage';

export default function Marketplace() {
  return <JarvisStubPage title="MARKETPLACE" icon={<Store size={13}/>} connectors={['Hermes Registry','Plugin Hub','Skill Store']} />;
}
