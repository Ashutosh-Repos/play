"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { UserStatus } from "@repo/common";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { onboardingSchema, type OnboardingInput } from "@/lib/validations/auth";
import { completeOnboardingAction } from "@/actions/auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const AVATAR_OPTIONS = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Milo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Bella",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Leo",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe",
];

function OnboardingForm() {
  const router = useRouter();
  const { update } = useSession();

  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [suggestion, setSuggestion] = useState("");

  const form = useForm<OnboardingInput>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      username: "",
      displayName: "",
      bio: "",
      avatarUrl: AVATAR_OPTIONS[0],
    },
    mode: "onChange",
  });

  const username = form.watch("username");
  const avatarUrl = form.watch("avatarUrl");

  // Check username availability on change (debounced)
  useEffect(() => {
    if (!username || username.length < 3) {
      setAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      try {
        const res = await fetch(`/api/users/check-username?username=${username}`);
        const data = await res.json();
        if (data.success) {
          setAvailable(data.data.available);
          setSuggestion(data.data.suggestion || "");
          if (!data.data.available) {
             form.setError("username", { message: "Username is taken" });
          } else {
             form.clearErrors("username");
          }
        }
      } catch {
        // Ignore
      } finally {
        setIsChecking(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [username, form]);

  const onSubmit = async (data: OnboardingInput) => {
    setIsLoading(true);
    setError("");

    try {
        const result = await completeOnboardingAction(data);

        if (!result.success) {
          setError(result.error || "Failed to complete onboarding");
          setIsLoading(false);
          return;
        }

        // Attempt to sync session
        // We retry a few times to account for replication lag or race conditions
        let updatedSession = await update();
        
        if (updatedSession?.user?.status === UserStatus.ACTIVE) {
             router.push("/");
             router.refresh(); 
             return;
        }

        // Retry once after delay
        await new Promise((r) => setTimeout(r, 1000));
        updatedSession = await update();

        if (updatedSession?.user?.status === UserStatus.ACTIVE) {
             router.push("/");
             router.refresh();
             return;
        }
        
        // If automatic sync fails, show success and simple link (escape hatch)
        // detailed error not needed, just let them click to go home (middleware will pass now)
        setIsLoading(false);
        // Force manual navigation window.location.href to ensure fresh request
        window.location.href = "/";

    } catch {
      setError("Something went wrong");
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-800 w-full max-w-lg">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome to Play!</h1>
        <p className="text-zinc-400">Let's set up your profile.</p>
        <div className="flex justify-center mt-4 space-x-2">
            <div className={`h-2 w-2 rounded-full ${step >= 1 ? 'bg-blue-500' : 'bg-zinc-700'}`}></div>
            <div className={`h-2 w-2 rounded-full ${step >= 2 ? 'bg-blue-500' : 'bg-zinc-700'}`}></div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && (
            <>
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-300">Username</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="johndoe" 
                          className="bg-zinc-800 border-zinc-700 text-white" 
                          {...field} 
                          onChange={(e) => {
                            field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                         {isChecking && <span className="text-zinc-400">Checking...</span>}
                         {!isChecking && available === true && <span className="text-green-400">✓ Available</span>}
                         {!isChecking && available === false && <span className="text-red-400">✗ Taken. Try: {suggestion}</span>}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-300">Display Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="John Doe" 
                          className="bg-zinc-800 border-zinc-700 text-white" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-300">Bio</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tell us about yourself..." 
                          className="bg-zinc-800 border-zinc-700 text-white resize-none" 
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!available || !username || username.length < 3}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Next: Choose Avatar
                </Button>
            </>
          )}

          {step === 2 && (
            <>
                <div className="space-y-4">
                    <FormLabel className="block text-center text-zinc-300">Select an Avatar</FormLabel>
                    <div className="grid grid-cols-3 gap-4">
                        {AVATAR_OPTIONS.map((url) => (
                            <div 
                                key={url}
                                onClick={() => form.setValue("avatarUrl", url)}
                                className={`cursor-pointer rounded-full p-1 border-2 ${avatarUrl === url ? 'border-blue-500' : 'border-transparent hover:border-zinc-500'}`}
                            >
                                <img src={url} alt="Avatar" className="w-full h-full rounded-full bg-zinc-800" />
                            </div>
                        ))}
                    </div>

                     {/* Upload Section Placeholder - keeping simplified for now as per "simple" request, 
                         but wired to form state if we want to re-enable upload logic later.
                         For now, just using presets is safer/faster for "industry standard" MVP.
                     */}
                </div>

                <div className="flex space-x-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(1)}
                      className="w-1/3 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      disabled={isLoading}
                      className="w-2/3 bg-green-600 hover:bg-green-700"
                    >
                      {isLoading ? "Setting up..." : "Finish Setup"}
                    </Button>
                </div>
            </>
          )}
        </form>
      </Form>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="text-white">Loading...</div>}>
      <OnboardingForm />
    </Suspense>
  );
}
