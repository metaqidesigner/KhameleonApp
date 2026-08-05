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

  const { text, voice_id, model_id } = req.body as {
    text?: string;
    voice_id?: string;
    model_id?: string;
  };

  if (!text || typeof text !== "string" || text.trim() === "") {
    res.status(400).json({ error: "text is required" });
    return;
  }

  const voiceId = voice_id ?? VOICE_ID;
  const modelId = model_id ?? MODEL_ID;

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
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
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

export default router;
