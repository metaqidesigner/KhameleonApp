import React from 'react';
import { MessageSquare } from 'lucide-react';
import JarvisStubPage from '@/components/JarvisStubPage';

export default function Chat() {
  return <JarvisStubPage title="CHAT" icon={<MessageSquare size={13}/>} connectors={['OpenAI','Anthropic','Ollama','LM Studio']} />;
}
