import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { AmbientBackground } from "@/components/lifeos/AmbientBackground";
import { AIOrb } from "@/components/lifeos/AIOrb";

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
        if (
          event === "SIGNED_IN" &&
          session
        ) {
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

    if (
      mode === "signup" &&
      !name.trim()
    ) {
      toast.error("Please enter your name.");
      return;
    }

    setBusy(true);

    try {
      if (mode === "signup") {
        /*
         * Create new account
         */
        const {
          data,
          error,
        } = await supabase.auth.signUp({
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

        /*
         * If Supabase immediately creates a session,
         * go directly to dashboard.
         */
        if (data.session) {
          toast.success(
            "Account created successfully!",
          );

          navigate({
            to: "/dashboard",
          });

          return;
        }

        /*
         * Email confirmation is enabled.
         */
        toast.success(
          "Account created! Check your email to confirm your account.",
        );

        setMode("signin");
      } else {
        /*
         * Existing user sign in
         */
        const {
          error,
        } =
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

  return (
    <div className="relative flex min-h-screen items-center justify-center px-5 py-12">
      <AmbientBackground
        state="IDLE"
        density="subtle"
      />

      <div className="panel relative z-10 w-full max-w-md p-7">
        {/* Header */}
        <div className="flex items-center gap-4">
          <AIOrb
            state="IDLE"
            size={56}
          />

          <div>
            <h1 className="text-xl font-semibold">
              {mode === "signin"
                ? "Welcome back to LifeOS"
                : "Create your LifeOS"}
            </h1>

            <p className="text-sm text-muted-foreground">
              Turn scattered information into
              clear actions.
            </p>
          </div>
        </div>

        {/* Authentication Form */}
        <form
          className="mt-7 space-y-4"
          onSubmit={submit}
        >
          {/* Name */}
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">
                Name
              </Label>

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
              />
            </div>
          )}

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">
              Email
            </Label>

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
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">
              Password
            </Label>

            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              autoComplete={
                mode === "signin"
                  ? "current-password"
                  : "new-password"
              }
              placeholder="••••••••"
              disabled={busy}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full"
            disabled={busy}
          >
            {busy
              ? "Working…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        {/* Security Message */}
        <div className="mt-5 rounded-xl border border-border/40 bg-background/40 p-3 text-center">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Your account is securely managed by
            Supabase Authentication.
          </p>
        </div>

        {/* Switch Sign In / Sign Up */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin"
            ? "New to LifeOS?"
            : "Already have an account?"}{" "}

          <button
            type="button"
            className="text-primary underline-offset-4 hover:underline disabled:opacity-50"
            disabled={busy}
            onClick={() =>
              setMode(
                mode === "signin"
                  ? "signup"
                  : "signin",
              )
            }
          >
            {mode === "signin"
              ? "Create an account"
              : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}