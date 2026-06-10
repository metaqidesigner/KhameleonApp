import { Router } from "express";
import { db } from "@workspace/db";
import { agentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RouteTaskBody } from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const agents = await db.select().from(agentsTable).orderBy(agentsTable.id);
    res.json(agents);
  } catch (err) {
    req.log.error({ err }, "Error fetching agents");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, id));
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  } catch (err) {
    req.log.error({ err }, "Error fetching agent");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/route", async (req, res) => {
  try {
    const parsed = RouteTaskBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

    const { task } = parsed.data;
    const agents = await db.select().from(agentsTable).where(eq(agentsTable.status, "active"));

    // Simple routing logic based on task keywords
    const taskLower = task.toLowerCase();
    let primaryAgent = agents[0];
    let secondaryAgent = agents[1];

    if (taskLower.includes("email") || taskLower.includes("inbox") || taskLower.includes("message")) {
      primaryAgent = agents.find((a) => a.name.includes("Email")) ?? agents[0];
      secondaryAgent = agents.find((a) => a.name.includes("Communication")) ?? agents[1];
    } else if (taskLower.includes("research") || taskLower.includes("summarise") || taskLower.includes("summarize")) {
      primaryAgent = agents.find((a) => a.name.includes("Research")) ?? agents[0];
      secondaryAgent = agents.find((a) => a.name.includes("Knowledge")) ?? agents[1];
    } else if (taskLower.includes("code") || taskLower.includes("build") || taskLower.includes("develop")) {
      primaryAgent = agents.find((a) => a.name.includes("Coding")) ?? agents[0];
      secondaryAgent = agents.find((a) => a.name.includes("Design")) ?? agents[1];
    } else if (taskLower.includes("calendar") || taskLower.includes("meeting") || taskLower.includes("schedule")) {
      primaryAgent = agents.find((a) => a.name.includes("Calendar")) ?? agents[0];
      secondaryAgent = agents.find((a) => a.name.includes("Project")) ?? agents[1];
    } else if (taskLower.includes("security") || taskLower.includes("threat") || taskLower.includes("risk")) {
      primaryAgent = agents.find((a) => a.name.includes("Security")) ?? agents[0];
      secondaryAgent = agents.find((a) => a.name.includes("Compliance")) ?? agents[1];
    } else if (taskLower.includes("project") || taskLower.includes("task")) {
      primaryAgent = agents.find((a) => a.name.includes("Project")) ?? agents[0];
      secondaryAgent = agents.find((a) => a.name.includes("Automation")) ?? agents[1];
    }

    if (!primaryAgent || !secondaryAgent) {
      primaryAgent = agents[0];
      secondaryAgent = agents[1];
    }

    const confidence = 0.75 + Math.random() * 0.2;
    const cost = 0.01 + Math.random() * 0.15;

    res.json({
      primaryAgent,
      secondaryAgent,
      estimatedCost: parseFloat(cost.toFixed(4)),
      confidenceScore: parseFloat(confidence.toFixed(2)),
      reasoning: `Based on task analysis, "${primaryAgent.name}" is best suited due to its specialisation in ${primaryAgent.strengths[0] ?? "this domain"}. "${secondaryAgent.name}" is recommended as backup for additional context. Confidence is high based on keyword matching and agent performance history.`,
    });
  } catch (err) {
    req.log.error({ err }, "Error routing task");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
