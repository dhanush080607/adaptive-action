import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, RefreshCw, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmbientBackground, type AmbientState } from "@/components/lifeos/AmbientBackground";
import { NextActionCard } from "@/components/lifeos/NextActionCard";
import { PlanTimeline, type TimelineItem } from "@/components/lifeos/PlanTimeline";
import { FeedbackDialog } from "@/components/lifeos/FeedbackDialog";
import { PriorityBadge } from "@/components/lifeos/PriorityBadge";
import { getDashboard, replan, submitFeedback, updateTask } from "@/lib/lifeos/api.functions";
import { formatDue, formatMinutesLabel, greeting, STATUS_LABELS } from "@/lib/lifeos/format";
import type { FeedbackKind } from "@/lib/lifeos/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — LifeOS" },
      {
        name: "description",
        content: "Your next best action, live plan and priority queue in one place.",
      },
      { property: "og:title", content: "Dashboard — LifeOS" },
      { property: "og:description", content: "One clear next action, always up to date." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard;
});

function Dashboard() {
  return null;
}
