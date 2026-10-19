import React from 'react';
import { Workflow } from 'lucide-react';
import KhameleonStubPage from '@/components/KhameleonStubPage';

export default function Automations() {
  return <KhameleonStubPage title="AUTOMATIONS" icon={<Workflow size={13}/>} connectors={['GitHub Actions','Zapier','Make','n8n']} />;
}
