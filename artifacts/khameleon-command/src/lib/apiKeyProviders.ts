import type { ApiKeyProvider } from './jarvisApi';

/**
 * Shared provider metadata for API keys and OAuth connectors. Split out
 * of pages/settings.tsx (which is lazy-loaded) so components mounted
 * eagerly at the app root - OnboardingWizard, same as VoiceController -
 * can reuse it without pulling the entire Settings page bundle into the
 * main chunk.
 */

export interface ApiKeyProviderDef {
  id: ApiKeyProvider;
  label: string;
  placeholder: string;
  helpUrl: string;
}

export const API_KEY_PROVIDER_DEFS: ApiKeyProviderDef[] = [
  { id: 'anthropic',  label: 'Anthropic (Claude)', placeholder: 'sk-ant-...',    helpUrl: 'console.anthropic.com/settings/keys' },
  { id: 'openai',     label: 'OpenAI (GPT)',       placeholder: 'sk-...',        helpUrl: 'platform.openai.com/api-keys' },
  { id: 'google',     label: 'Google (Gemini)',    placeholder: 'AIza...',       helpUrl: 'aistudio.google.com/apikey' },
  { id: 'openrouter', label: 'OpenRouter',         placeholder: 'sk-or-...',     helpUrl: 'openrouter.ai/keys' },
  { id: 'minimax',    label: 'Minimax',            placeholder: 'API key',       helpUrl: 'platform.minimax.chat' },
];

export interface ProviderDef {
  id: string;           // matches oauth_tokens.provider
  label: string;
  covers: string;       // human description of what it unlocks
  dataScope: string;    // what it can read - shown at the connect gate (§16.3)
  actionScope: string;  // what it can do - shown at the connect gate (§16.3)
  startPath: string;
  credentials: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'google',
    label: 'Google',
    covers: 'Gmail + Google Calendar',
    dataScope: 'Your Google account is verified, but nothing reads Gmail/Calendar/Drive/Contacts data yet.',
    actionScope: 'Not yet built on top of the connection.',
    startPath: '/api/auth/oauth/google/start',
    credentials: 'GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET',
  },
  {
    id: 'microsoft',
    label: 'Microsoft / Outlook',
    covers: 'Outlook Mail + Microsoft Calendar',
    dataScope: 'Read and search your Outlook inbox and threads.',
    actionScope: 'Draft, summarize, triage, and send email — sending requires your confirmation.',
    startPath: '/api/auth/oauth/microsoft/start',
    credentials: 'MICROSOFT_CLIENT_ID + MICROSOFT_CLIENT_SECRET',
  },
  {
    id: 'spotify',
    label: 'Spotify',
    covers: 'Now playing + playback control',
    dataScope: 'See what\'s currently playing.',
    actionScope: 'Control playback: play, pause, skip, previous.',
    startPath: '/api/auth/oauth/spotify/start',
    credentials: 'SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET',
  },
];
