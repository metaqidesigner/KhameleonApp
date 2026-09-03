import React from 'react';
import { Inbox as InboxIcon } from 'lucide-react';
import JPanel from '@/components/JPanel';
import JarvisStubPage from '@/components/JarvisStubPage';

export default function Inbox() {
  return <JarvisStubPage title="INBOX" icon={<InboxIcon size={13}/>} connectors={['Gmail','Slack','Telegram','Discord','WhatsApp']} />;
}
