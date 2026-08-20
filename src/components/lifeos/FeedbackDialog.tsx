import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { FeedbackKind } from "@/lib/lifeos/types";

const OPTIONS: { kind: FeedbackKind; label: string; hint: string }[] = [
  { kind: "completed", label: "Complete", hint: "Finished it" },
  { kind: "partial", label: "Partially complete", hint: "Made progress" },
  { kind: "took_longer", label: "Took longer", hint: "Done, but slower" },
  { kind: "delayed", label: "Delayed", hint: "Pushed it back" },
  { kind: "skipped", label: "Skipped", hint: "Didn't start" },
  { kind: "blocked", label: "Blocked", hint: "Something is in the way" },
  { kind: "not_relevant", label: "Not relevant", hint: "Drop this task" },
];

export function FeedbackDialog({
  open,
  onOpenChange,
  taskTitle,
  estimatedMinutes,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  taskTitle: string;
  estimatedMinutes: number;
  submitting?: boolean;
  onSubmit: (payload: {
    kind: FeedbackKind;
    note?: string;
    actual_minutes?: number;
    progress?: number;
  }) => void;
}) {
  const [kind, setKind] = useState<FeedbackKind>("completed");
  const [note, setNote] = useState("");
  const [actual, setActual] = useState<string>("");
  const [progress, setProgress] = useState<string>("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>What happened with this task?</DialogTitle>
          <DialogDescription>
            {taskTitle} — estimated {estimatedMinutes} min. LifeOS will evaluate the impact and
            rebuild your plan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <button
              key={o.kind}
              type="button"
              onClick={() => setKind(o.kind)}
              aria-pressed={kind === o.kind}
              className={`rounded-lg border p-3 text-left transition-colors ${
                kind === o.kind
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/60 hover:border-border hover:bg-muted/40"
              }`}
            >
              <span className="block text-sm font-medium">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.hint}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="actual">Actual minutes spent</Label>
            <Input
              id="actual"
              type="number"
              min={0}
              max={1200}
              inputMode="numeric"
              placeholder={String(estimatedMinutes)}
              value={actual}
              onChange={(e) => setActual(e.target.value)}
            />
          </div>
          {kind === "partial" && (
            <div className="space-y-1.5">
              <Label htmlFor="progress">Progress now (%)</Label>
              <Input
                id="progress"
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="note">Anything LifeOS should know?</Label>
          <Textarea
            id="note"
            rows={3}
            placeholder="The assignment took longer because the API was broken..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            disabled={submitting}
            onClick={() =>
              onSubmit({
                kind,
                note: note.trim() || undefined,
                actual_minutes: actual ? Number(actual) : undefined,
                progress: progress ? Number(progress) : undefined,
              })
            }
          >
            {submitting ? "Evaluating…" : "Submit & replan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
