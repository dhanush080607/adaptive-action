import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { AmbientBackground } from "@/components/lifeos/AmbientBackground";
import { AIOrb } from "@/components/lifeos/AIOrb";
import { ArrowRight, Check, Eye, EyeOff, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      {
        title: "Sign in to LifeOS",
      },
      {
        name: "description",
        content:
          "Sign in to LifeOS to capture your context and get your next best action.",
      },
      {
        property: "og:title",
        content: "Sign in to LifeOS",
      },
      {
        property: "og:description",
        content:
          "Your AI action system for goals and deadlines.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary_large_image",
      },
    ],
  }),

  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  const [mode, setMode] =
    useState<"signin" | "signup">("signin");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /*
   * Check existing authentication session
   */
  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        navigate({
          to: "/dashboard",
        });
      }
    };

    checkSession();
  }, [navigate]);

  /*
   * Listen for authentication changes
   */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          navigate({
            to: "/dashboard",
          });
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  /*
   * Sign in / Sign up
   */
  const submit = async (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    if (!email.trim()) {
      toast.error("Please enter your email.");
      return;
    }

    if (!password) {
      toast.error("Please enter your password.");
      return;
    }

    if (password.length < 6) {
      toast.error(
        "Password must be at least 6 characters.",
      );
      return;
    }

    if (mode === "signup" && !name.trim()) {
      toast.error("Please enter your name.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "signup") {
        const { data, error } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,

            options: {
              data: {
                name: name.trim(),
              },

              emailRedirectTo:
                `${window.location.origin}/auth`,
            },
          });

        if (error) {
          throw error;
        }

        if (data.session) {
          toast.success(
            "Account created successfully!",
          );

          navigate({
            to: "/dashboard",
          });

          return;
        }

        toast.success(
          "Account created! Check your email to confirm your account.",
        );

        setMode("signin");
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) {
          throw error;
        }

        toast.success(
          "Welcome back to LifeOS!",
        );

        navigate({
          to: "/dashboard",
        });
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Authentication failed.";

      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const isSignup = mode === "signup";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">

      {/* Background */}
      <AmbientBackground
        state="IDLE"
        density="subtle"
      />

      {/* Ambient glow layers */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px] animate-pulse" />

        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px] animate-[pulse_5s_ease-in-out_infinite]" />

        <div className="absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-blue-500/10 blur-[110px] animate-[pulse_6s_ease-in-out_infinite]" />
      </div>

      {/* Floating particles */}
      <div className="pointer-events-none absolute inset-0">
        <span className="absolute left-[15%] top-[20%] h-1 w-1 rounded-full bg-primary/70 animate-ping" />
        <span className="absolute left-[80%] top-[25%] h-1.5 w-1.5 rounded-full bg-cyan-400/60 animate-pulse" />
        <span className="absolute left-[20%] bottom-[20%] h-1 w-1 rounded-full bg-blue-400/60 animate-ping" />
        <span className="absolute right-[15%] bottom-[30%] h-1 w-1 rounded-full bg-primary/70 animate-pulse" />
      </div>

      {/* Main Card */}
      <div
        className="
          relative z-10 w-full max-w-md
          animate-in fade-in slide-in-from-bottom-6
          duration-700
        "
      >

        {/* Outer glow */}
        <div className="absolute -inset-[1px] rounded-[28px] bg-gradient-to-r from-primary/30 via-cyan-400/20 to-primary/30 opacity-70 blur-sm" />

        <div
          className="
            relative overflow-hidden
            rounded-[28px]
            border border-white/10
            bg-background/70
            p-7 sm:p-8
            shadow-2xl
            backdrop-blur-2xl
          "
        >

          {/* Top shine */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

          {/* Header */}
          <div className="text-center">

            {/* Orb */}
            <div className="relative mx-auto mb-5 w-fit">

              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl animate-pulse" />

              <div className="relative rounded-full border border-primary/20 bg-background/60 p-2 shadow-[0_0_40px_rgba(0,200,255,0.12)]">
                <AIOrb
                  state="IDLE"
                  size={68}
                />
              </div>

              <div className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-background shadow-lg">
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
            </div>

            <div className="space-y-2">

              <h1 className="text-2xl font-bold tracking-tight">
                {isSignup
                  ? "Create your LifeOS"
                  : "Welcome back"}
              </h1>

              <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
                {isSignup
                  ? "Build a smarter system for turning information into action."
                  : "Your personal AI action system is ready."}
              </p>

            </div>

            {/* Status */}
            <div className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>

              <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
                LIFEOS AI ONLINE
              </span>
            </div>
          </div>

          {/* Form */}
          <form
            className="mt-8 space-y-5"
            onSubmit={submit}
          >

            {/* Name */}
            {isSignup && (
              <div
                className="
                  animate-in fade-in slide-in-from-top-2
                  duration-300
                  space-y-2
                "
              >
                <Label
                  htmlFor="name"
                  className="text-xs font-medium text-muted-foreground"
                >
                  NAME
                </Label>

                <div className="group relative">

                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    autoComplete="name"
                    placeholder="Your name"
                    disabled={busy}
                    className="
                      h-12 rounded-xl
                      border-white/10
                      bg-white/[0.03]
                      px-4
                      transition-all
                      duration-300
                      focus:border-primary/50
                      focus:bg-primary/[0.03]
                      focus:ring-2
                      focus:ring-primary/10
                    "
                  />

                  <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 ring-1 ring-primary/30 transition-opacity group-focus-within:opacity-100" />

                </div>
              </div>
            )}

            {/* Email */}
            <div className="space-y-2">

              <Label
                htmlFor="email"
                className="text-xs font-medium text-muted-foreground"
              >
                EMAIL ADDRESS
              </Label>

              <div className="group relative">

                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={busy}
                  className="
                    h-12 rounded-xl
                    border-white/10
                    bg-white/[0.03]
                    px-4
                    transition-all
                    duration-300
                    focus:border-primary/50
                    focus:bg-primary/[0.03]
                    focus:ring-2
                    focus:ring-primary/10
                  "
                />

                <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 ring-1 ring-primary/30 transition-opacity group-focus-within:opacity-100" />

              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">

              <Label
                htmlFor="password"
                className="text-xs font-medium text-muted-foreground"
              >
                PASSWORD
              </Label>

              <div className="group relative">

                <Input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  autoComplete={
                    isSignup
                      ? "new-password"
                      : "current-password"
                  }
                  placeholder="••••••••"
                  disabled={busy}
                  className="
                    h-12 rounded-xl
                    border-white/10
                    bg-white/[0.03]
                    px-4 pr-12
                    transition-all
                    duration-300
                    focus:border-primary/50
                    focus:bg-primary/[0.03]
                    focus:ring-2
                    focus:ring-primary/10
                  "
                />

                <button
                  type="button"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                  onClick={() =>
                    setShowPassword(
                      !showPassword,
                    )
                  }
                  className="
                    absolute right-3 top-1/2
                    -translate-y-1/2
                    rounded-lg p-2
                    text-muted-foreground
                    transition-colors
                    hover:text-foreground
                  "
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>

                <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 ring-1 ring-primary/30 transition-opacity group-focus-within:opacity-100" />

              </div>
            </div>

            {/* Security */}
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">

              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-3.5 w-3.5 text-primary" />
              </div>

              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Your data is protected with
                secure Supabase authentication.
              </p>

            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={busy}
              className="
                group relative h-12 w-full
                overflow-hidden rounded-xl
                border border-primary/20
                bg-primary
                font-semibold
                shadow-lg
                shadow-primary/10
                transition-all
                duration-300
                hover:-translate-y-0.5
                hover:shadow-xl
                hover:shadow-primary/20
                active:translate-y-0
              "
            >

              {/* Button shine */}
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

              <span className="relative flex items-center justify-center gap-2">

                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                    Processing...
                  </>
                ) : (
                  <>
                    {isSignup
                      ? "Create my LifeOS"
                      : "Enter LifeOS"}

                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </>
                )}

              </span>
            </Button>
          </form>

          {/* Switch mode */}
          <div className="mt-7 text-center">

            <p className="text-sm text-muted-foreground">

              {isSignup
                ? "Already have an account?"
                : "New to LifeOS?"}

              {" "}

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setMode(
                    isSignup
                      ? "signin"
                      : "signup",
                  );

                  setShowPassword(false);
                }}
                className="
                  font-medium
                  text-primary
                  transition-all
                  hover:text-primary/80
                  hover:underline
                  disabled:opacity-50
                "
              >
                {isSignup
                  ? "Sign in"
                  : "Create an account"}
              </button>

            </p>
          </div>

          {/* Footer */}
          <div className="mt-7 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">

            <span className="h-px w-8 bg-border/40" />

            <span>AI Action System</span>

            <span className="h-px w-8 bg-border/40" />

          </div>

        </div>
      </div>
    </div>
  );
}
