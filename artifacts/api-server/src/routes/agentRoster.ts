import { Router } from 'express';
import { randomUUID } from 'crypto';
import { askAgent, isAgentAvailable } from '../agents/gateway.js';
import { getRoster, findAgent, upsertAgent, removeAgent } from '../agents/defaults.js';
import { recordQuery, getMetrics, getHistory, getAllMetrics } from '../agents/store.js';
import type { AgentConfig, ChatMessage } from '../agents/types.js';

const router = Router();

function maskConfig(c: AgentConfig) {
  return { ...c, apiKey: c.apiKey ? 'SET' : 'NOT SET' };
}

// GET /api/agents/roster
router.get('/roster', (_req, res) => {
  res.json(getRoster().map(maskConfig));
});

// POST /api/agents/roster
router.post('/roster', (req, res) => {
  const body = req.body as Partial<AgentConfig>;
  if (!body.name || !body.provider || !body.model) {
    res.status(400).json({ error: 'name, provider, model required' });
    return;
  }
  const agent: AgentConfig = {
    id:           body.id ?? randomUUID().slice(0, 8),
    name:         body.name,
    provider:     body.provider,
    model:        body.model,
    apiKey:       body.apiKey,
    baseUrl:      body.baseUrl,
    enabled:      body.enabled ?? true,
    role:         body.role ?? 'general',
    systemPrompt: body.systemPrompt ?? 'You are a helpful AI assistant.',
    color:        body.color ?? '#00d4ff',
    initials:     body.initials ?? body.name.slice(0, 2).toUpperCase(),
  };
  upsertAgent(agent);
  res.json(maskConfig(agent));
});

// DELETE /api/agents/roster/:id
router.delete('/roster/:id', (req, res) => {
  const removed = removeAgent(req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Custom agent not found (built-ins cannot be deleted)' });
    return;
  }
  res.json({ ok: true });
});

// GET /api/agents/metrics  — all agents (before /:id routes)
router.get('/metrics', (_req, res) => {
  res.json(getAllMetrics());
});

// GET /api/agents/:id/status
router.get('/:id/status', async (req, res) => {
  const agent = findAgent(req.params.id);
  if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
  const available = isAgentAvailable(agent);
  res.json({
    agentId:  agent.id,
    status:   available ? 'online' : 'standby',
    model:    agent.model,
    provider: agent.provider,
  });
});

// GET /api/agents/:id/metrics
router.get('/:id/metrics', (req, res) => {
  const agent = findAgent(req.params.id);
  if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
  res.json(getMetrics(agent.id));
});

// GET /api/agents/:id/history
router.get('/:id/history', (req, res) => {
  const agent = findAgent(req.params.id);
  if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }
  res.json(getHistory(agent.id));
});

// POST /api/agents/ask-all  (before /:id/ask to avoid ambiguity)
router.post('/ask-all', async (req, res) => {
  const { messages, agent_ids, mode = 'parallel' } = req.body as {
    messages: ChatMessage[];
    agent_ids?: string[];
    mode?: 'parallel' | 'vote';
  };
  if (!messages?.length) { res.status(400).json({ error: 'messages required' }); return; }

  const roster  = getRoster().filter(a => a.enabled);
  const targets = agent_ids ? roster.filter(a => agent_ids.includes(a.id)) : roster;
  const results = await Promise.all(targets.map(a => askAgent(a, messages)));

  results.forEach(r => {
    if (!r.error) {
      recordQuery(r.agentId, r.latencyMs, r.tokens, r.costUsd, r.energyWh,
        messages[messages.length - 1]?.content ?? '', r.content, r.model);
    }
  });

  if (mode === 'vote') {
    const judge = findAgent('claude') ?? findAgent('gpt4o') ?? targets[0];
    if (judge) {
      const summaries = results
        .map(r => `[${r.agentId}]: ${r.content.slice(0, 300)}`)
        .join('\n\n');
      const voteMsg: ChatMessage[] = [
        ...messages,
        { role: 'user', content: `Here are responses from multiple AI agents:\n\n${summaries}\n\nWhich response is best and why? Cite the agent ID.` },
      ];
      const verdict = await askAgent(judge, voteMsg);
      res.json({ results, verdict, mode: 'vote' });
      return;
    }
  }
  res.json({ results, mode });
});

// POST /api/agents/compare
router.post('/compare', async (req, res) => {
  const { prompt, agent_ids } = req.body as { prompt: string; agent_ids: string[] };
  if (!prompt || !agent_ids?.length) { res.status(400).json({ error: 'prompt and agent_ids required' }); return; }

  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
  const agents = agent_ids.map(id => findAgent(id)).filter((a): a is AgentConfig => !!a);
  const results = await Promise.all(agents.map(a => askAgent(a, messages)));
  results.forEach(r => {
    if (!r.error) recordQuery(r.agentId, r.latencyMs, r.tokens, r.costUsd, r.energyWh, prompt, r.content, r.model);
  });

  res.json({
    prompt,
    comparison: results.map(r => ({
      agentId: r.agentId, content: r.content, latencyMs: r.latencyMs,
      tokens: r.tokens, costUsd: r.costUsd, error: r.error,
    })),
  });
});

// POST /api/agents/:id/ask — streaming or JSON
router.post('/:id/ask', async (req, res) => {
  const agent = findAgent(req.params.id);
  if (!agent) { res.status(404).json({ error: 'Agent not found' }); return; }

  const { messages, stream } = req.body as { messages: ChatMessage[]; stream?: boolean };
  if (!messages?.length) { res.status(400).json({ error: 'messages required' }); return; }

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const result = await askAgent(agent, messages, (token) => {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    });

    if (result.error) {
      res.write(`data: ${JSON.stringify({ error: result.error })}\n\n`);
    } else {
      recordQuery(
        agent.id, result.latencyMs, result.tokens, result.costUsd, result.energyWh,
        messages[messages.length - 1]?.content ?? '', result.content, result.model,
      );
    }
    res.write(`data: ${JSON.stringify({ done: true, agentId: result.agentId, model: result.model, latencyMs: result.latencyMs, tokens: result.tokens, costUsd: result.costUsd })}\n\n`);
    res.end();
    return;
  }

  const result = await askAgent(agent, messages);
  if (!result.error) {
    recordQuery(
      agent.id, result.latencyMs, result.tokens, result.costUsd, result.energyWh,
      messages[messages.length - 1]?.content ?? '', result.content, result.model,
    );
  }
  res.json(result);
});

export default router;
