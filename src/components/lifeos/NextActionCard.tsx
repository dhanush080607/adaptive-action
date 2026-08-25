import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Sparkles,
  Timer,
  Cpu,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { PriorityBadge } from "./PriorityBadge";
import { formatMinutesLabel } from "@/lib/lifeos/format";
import type { NextAction } from "@/lib/lifeos/types";

export function NextActionCard({
  action,
  onStart,
  onFeedback,
  busy,
}: {
  action: NextAction;
  onStart?: () => void;
  onFeedback?: () => void;
  busy?: boolean;
}) {
  if (!action) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="panel rise-in relative overflow-hidden rounded-2xl border border-border/60 bg-surface/80 p-8 backdrop-blur-md"
      >
        <motion.div
          animate={{
            scale: [1, 1.08, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative">
          <div className="flex items-center gap-2 text-primary">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Sparkles className="h-4 w-4" />
            </motion.div>

            <span className="label-caps">Your Next Action</span>
          </div>

          <h2 className="mt-3 text-2xl font-semibold text-gradient tracking-tight">
            Nothing to do next — yet.
          </h2>

          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Capture what's on your mind and LifeOS will turn it into a
            prioritized plan with one clear next step.
          </p>

          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-block"
          >
            <Button
              asChild
              className="mt-6 border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 transition-all shadow-glow-cyan/20"
            >
              <Link to="/capture">
                <Sparkles className="mr-2 h-4 w-4" />
                Capture your information
              </Link>
            </Button>
          </motion.div>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.55,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{
        y: -3,
        transition: { duration: 0.2 },
      }}
      className="focal-panel relative overflow-hidden rounded-2xl border border-border/80 bg-surface/90 p-6 sm:p-8 backdrop-blur-md transition-all shadow-glow-cyan/10 hover:shadow-glow-cyan/20"
      aria-labelledby="next-action-title"
    >
      {/* Animated ambient glow */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.35, 0.55, 0.35],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
      />

      {/* Subtle moving light */}
      <motion.div
        animate={{
          x: [-120, 500],
          opacity: [0, 0.35, 0],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "linear",
          repeatDelay: 2,
        }}
        className="pointer-events-none absolute top-0 h-full w-24 rotate-12 bg-gradient-to-r from-transparent via-primary/10 to-transparent blur-xl"
      />

      <div className="relative">
        {/* Header Metadata */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-3"
        >
          <p className="label-caps flex items-center gap-1.5 text-primary font-semibold">
            <motion.span
              animate={{
                scale: [1, 1.25, 1],
                rotate: [0, 8, -8, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </motion.span>

            Your Next Action
          </p>

          <PriorityBadge level={action.priority} />

          <motion.span
            whileHover={{ scale: 1.05 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-2.5 py-0.5 font-mono text-xs text-muted-foreground backdrop-blur-xs"
          >
            <Timer className="h-3.5 w-3.5 text-primary" />
            {formatMinutesLabel(action.estimated_minutes)}
          </motion.span>

          <span className="ml-auto inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <Cpu className="h-3 w-3 text-primary/70" />
            {Math.round(action.confidence * 100)}% confidence
          </span>
        </motion.div>

        {/* Main Task Title */}
        <motion.h2
          id="next-action-title"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.45 }}
          className="mt-4 text-2xl font-semibold leading-tight text-foreground sm:text-3xl tracking-tight"
        >
          {action.task}
        </motion.h2>

        {/* Rationale Panel */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
          whileHover={{
            borderColor: "hsl(var(--primary) / 0.3)",
          }}
          className="mt-5 rounded-xl border border-border/60 bg-background/40 p-4.5 backdrop-blur-sm transition-colors"
        >
          <p className="label-caps text-xs text-primary/90 flex items-center gap-1.5">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.4,
                type: "spring",
                stiffness: 300,
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </motion.span>

            Why this matters now
          </p>

          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 font-medium">
            {action.reason}
          </p>

          {action.factors.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t border-border/30 pt-3">
              {action.factors.map((f, index) => (
                <motion.li
                  key={f}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: 0.35 + index * 0.06,
                  }}
                  className="flex items-start gap-2 text-xs text-muted-foreground"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/80" />
                  <span>{f}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </motion.div>

        {/* Action Controls */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 flex flex-wrap items-center gap-3"
        >
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Button
              size="lg"
              onClick={onStart}
              disabled={busy}
              className="border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-glow-cyan/30 px-6 font-medium"
            >
              Start Focus Mode

              <motion.span
                animate={{ x: [0, 4, 0] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                }}
              >
                <ArrowRight className="ml-2 h-4 w-4" />
              </motion.span>
            </Button>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <Button
              size="lg"
              variant="secondary"
              onClick={onFeedback}
              disabled={busy}
              className="border border-border/60 bg-surface hover:bg-surface-elevated hover:border-border transition-all text-foreground/90"
            >
              <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
              Give Feedback
            </Button>
          </motion.div>

          <motion.div
            whileHover={{ x: 3 }}
            transition={{ duration: 0.2 }}
          >
            <Button
              size="lg"
              variant="ghost"
              asChild
              className="text-muted-foreground hover:text-foreground"
            >
              <Link to="/tasks/$id" params={{ id: action.task_id }}>
                Task Details
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </motion.section>
  );
}