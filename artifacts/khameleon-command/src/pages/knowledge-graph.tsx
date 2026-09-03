import React from 'react';
import { Network } from 'lucide-react';
import JarvisStubPage from '@/components/JarvisStubPage';

export default function Knowledge() {
  return <JarvisStubPage title="KNOWLEDGE GRAPH" icon={<Network size={13}/>} connectors={['Obsidian','Notion','GitHub','Web Crawler']} />;
}
