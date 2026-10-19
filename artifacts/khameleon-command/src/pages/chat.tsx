import React from 'react';
import { MessageSquare } from 'lucide-react';
import KhameleonStubPage from '@/components/KhameleonStubPage';

export default function Chat() {
  return <KhameleonStubPage title="CHAT" icon={<MessageSquare size={13}/>} connectors={['Khami']} />;
}
