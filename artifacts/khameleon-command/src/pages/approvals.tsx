import React from 'react';
import { CheckSquare } from 'lucide-react';
import JarvisStubPage from '@/components/JarvisStubPage';

export default function Approvals() {
  return <JarvisStubPage title="APPROVALS" icon={<CheckSquare size={13}/>} connectors={['GitHub','Linear','Jira','Notion']} />;
}
