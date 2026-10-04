import { Router } from "express";

const router = Router();

const VOICE_ID  = process.env.ELEVENLABS_VOICE_ID  ?? "wDsJlOXPqcvIUKdLXjDs";
const MODEL_ID  = process.env.ELEVENLABS_MODEL_ID  ?? "eleven_turbo_v2_5";

router.post("/tts", async (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "ELEVENLABS_API_KEY not configured" });
    return;
  }

  const { text, voice_id, model_id, speed } = req.body as {
    text?: string;
    voice_id?: string;
    model_id?: string;
    speed?: number;
  };

  if (!text || typeof text !== "string" || text.trim() === "") {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const voiceId = voice_id ?? VOICE_ID;
  const modelId = model_id ?? MODEL_ID;

  // ElevenLabs documents a valid speed range of 0.7-1.2 - clamp rather than
  // forward an out-of-range value and risk a 400 from the upstream API.
  const voiceSettings: Record<string, number | boolean> = {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    use_speaker_boost: true,
  };
  if (typeof speed === "number" && Number.isFinite(speed)) {
    voiceSettings.speed = Math.min(1.2, Math.max(0.7, speed));
  }

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 5000),
          model_id: modelId,
          voice_settings: voiceSettings,
        }),
      }
    );

    if (!upstream.ok) {
      const errBody = await upstream.text();
      req.log.warn({ status: upstream.status, body: errBody }, "ElevenLabs error");
      res.status(upstream.status).json({ error: "ElevenLabs request failed", detail: errBody });
      return;
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-store");

    // Stream the audio chunks directly to the client
    const reader = upstream.body!.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    };
    await pump();
  } catch (err) {
    req.log.error({ err }, "ElevenLabs TTS failed");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal TTS error" });
    }
  }
});

// Probe endpoint — lets the frontend check if ElevenLabs is configured
router.get("/tts/status", (_req, res) => {
  res.json({ configured: !!process.env.ELEVENLABS_API_KEY });
});

// Real ElevenLabs voice list, for the Settings > Voice picker - lets a user
// pick their own output voice instead of only ever hearing the one
// hardcoded default (ELEVENLABS_VOICE_ID). Honest 503 when unconfigured,
// same as every other provider-gated endpoint in this app.
router.get("/voices", async (req, res) => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "ELEVENLABS_API_KEY not configured" });
    return;
  }
  try {
    const upstream = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: "Could not list ElevenLabs voices" });
      return;
    }
    const json = (await upstream.json()) as { voices?: { voice_id: string; name: string }[] };
    res.json((json.voices ?? []).map((v) => ({ voiceId: v.voice_id, name: v.name })));
  } catch (err) {
    req.log.error({ err }, "ElevenLabs voice list failed");
    res.status(502).json({ error: "Could not list ElevenLabs voices" });
  }
});

export default router;
