import React from 'react';
import { Network } from 'lucide-react';
import KhameleonStubPage from '@/components/KhameleonStubPage';

export default function Knowledge() {
  return <KhameleonStubPage title="KNOWLEDGE GRAPH" icon={<Network size={13}/>} connectors={['Obsidian','Notion','GitHub','Web Crawler']} />;
}
