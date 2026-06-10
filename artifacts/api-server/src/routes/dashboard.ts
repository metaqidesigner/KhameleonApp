import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  tasksTable,
  approvalsTable,
  securityLayersTable,
  agentsTable,
  communicationsTable,
  calendarEventsTable,
  operatingModesTable,
  insightsTable,
} from "@workspace/db";
import { eq, count, and, sql } from "drizzle-orm";

const router = Router();

router.get("/summary", async (req, res) => {
  try {
    const [activeProjectsResult] = await db
      .select({ count: count() })
      .from(projectsTable)
      .where(eq(projectsTable.status, "active"));

    const [pendingTasksResult] = await db
      .select({ count: count() })
      .from(tasksTable)
      .where(eq(tasksTable.status, "todo"));

    const [pendingApprovalsResult] = await db
      .select({ count: count() })
      .from(approvalsTable)
      .where(eq(approvalsTable.status, "pending"));

    const layers = await db.select().from(securityLayersTable);
    const securityScore =
      layers.length > 0
        ? Math.round(layers.reduce((sum, l) => sum + l.score, 0) / layers.length)
        : 95;

    const [activeAgentsResult] = await db
      .select({ count: count() })
      .from(agentsTable)
      .where(eq(agentsTable.status, "active"));

    const [unreadResult] = await db
      .select({ count: count() })
      .from(communicationsTable)
      .where(eq(communicationsTable.isRead, false));

    const now = new Date();
    const todayStart = now.toISOString().split("T")[0];
    const allEvents = await db.select().from(calendarEventsTable);
    const todayMeetings = allEvents.filter((e) =>
      e.startTime.startsWith(todayStart)
    ).length;

    const activeMode = await db
      .select()
      .from(operatingModesTable)
      .where(eq(operatingModesTable.isActive, true))
      .limit(1);

    res.json({
      systemHealth: 97,
      activeProjects: activeProjectsResult?.count ?? 0,
      pendingTasks: pendingTasksResult?.count ?? 0,
      pendingApprovals: pendingApprovalsResult?.count ?? 0,
      securityScore,
      activeAgents: activeAgentsResult?.count ?? 0,
      unreadMessages: unreadResult?.count ?? 0,
      todayMeetings,
      currentMode: activeMode[0]?.name ?? "Work Mode",
    });
  } catch (err) {
    req.log.error({ err }, "Error fetching dashboard summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analytics", async (_req, res) => {
  res.json({
    taskCompletion: [
      { label: "Mon", value: 8 },
      { label: "Tue", value: 12 },
      { label: "Wed", value: 7 },
      { label: "Thu", value: 15 },
      { label: "Fri", value: 11 },
      { label: "Sat", value: 4 },
      { label: "Sun", value: 6 },
    ],
    agentPerformance: [
      { name: "Email Agent", reliability: 98, tasks: 145, cost: 0.02 },
      { name: "Research Agent", reliability: 94, tasks: 87, cost: 0.08 },
      { name: "Coding Agent", reliability: 96, tasks: 62, cost: 0.12 },
      { name: "Calendar Agent", reliability: 99, tasks: 203, cost: 0.01 },
      { name: "Security Agent", reliability: 99, tasks: 41, cost: 0.05 },
    ],
    communicationVolume: [
      { label: "Mon", value: 34 },
      { label: "Tue", value: 52 },
      { label: "Wed", value: 28 },
      { label: "Thu", value: 67 },
      { label: "Fri", value: 45 },
      { label: "Sat", value: 12 },
      { label: "Sun", value: 8 },
    ],
    securityTrends: [
      { label: "Week 1", value: 88 },
      { label: "Week 2", value: 91 },
      { label: "Week 3", value: 89 },
      { label: "Week 4", value: 95 },
    ],
    timeAllocation: [
      { name: "Strategic Work", value: 35, color: "#00d4ff" },
      { name: "Communications", value: 25, color: "#c9a84c" },
      { name: "Meetings", value: 20, color: "#3b82f6" },
      { name: "Admin", value: 12, color: "#8b5cf6" },
      { name: "Research", value: 8, color: "#10b981" },
    ],
    projectProgress: [
      { name: "AITradingMarket", progress: 72, status: "on-track" },
      { name: "Chameleon", progress: 45, status: "at-risk" },
      { name: "Property Gov.", progress: 88, status: "on-track" },
      { name: "Economic Sim.", progress: 31, status: "delayed" },
      { name: "Nexus Command", progress: 65, status: "on-track" },
    ],
  });
});

export default router;
