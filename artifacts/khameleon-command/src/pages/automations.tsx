import React from 'react';
import { Workflow } from 'lucide-react';
import JarvisStubPage from '@/components/JarvisStubPage';

export default function Automations() {
  return <JarvisStubPage title="AUTOMATIONS" icon={<Workflow size={13}/>} connectors={['GitHub Actions','Zapier','Make','n8n']} />;
}
