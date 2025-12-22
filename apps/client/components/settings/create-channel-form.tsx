"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createChannel, type CreateChannelInput } from "@/app/actions/channel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { IconLoader2, IconBrandYoutube, IconCheck, IconX } from "@tabler/icons-react";

const createChannelSchema = z.object({
  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(30, "Handle must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
  displayName: z.string().min(1, "Display name is required").max(50, "Max 50 characters"),
  description: z.string().max(1000, "Max 1000 characters").optional(),
});

export function CreateChannelForm() {
  const [isPending, startTransition] = useTransition();
  const [isChecking, setIsChecking] = useState(false);
  const [handleAvailable, setHandleAvailable] = useState<boolean | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const router = useRouter();

  const form = useForm<CreateChannelInput>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: { handle: "", displayName: "", description: "" },
    mode: "onChange",
  });

  const handleValue = form.watch("handle");

  // Debounced handle availability check
  useEffect(() => {
    if (!handleValue || handleValue.length < 3) {
      setHandleAvailable(null);
      setSuggestion("");
      return;
    }

    // Validate format first
    if (!/^[a-zA-Z0-9_]+$/.test(handleValue)) {
      setHandleAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsChecking(true);
      try {
        const res = await fetch(`/api/channels/check-handle?handle=${handleValue}`);
        const data = await res.json();
        if (data.success) {
          setHandleAvailable(data.data.available);
          setSuggestion(data.data.suggestion || "");
          if (data.data.available === false) {
            form.setError("handle", { message: "Handle is already taken" });
          } else if (data.data.available === true) {
            form.clearErrors("handle");
          }
        }
      } catch {
        // Ignore errors
      } finally {
        setIsChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [handleValue, form]);

  async function onSubmit(data: CreateChannelInput) {
    if (handleAvailable !== true) {
      toast.error("Please choose an available handle");
      return;
    }

    startTransition(async () => {
      const result = await createChannel(data);
      if (result.success) {
        toast.success("Channel created! You're now a creator.");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to create channel");
      }
    });
  }

  const canSubmit = handleAvailable === true && !isPending && form.formState.isValid;

  return (
    <Card className="border-dashed">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <IconBrandYoutube className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>Create Your Channel</CardTitle>
        <CardDescription className="max-w-sm mx-auto">
          Start sharing content with the world. Create your channel to upload videos 
          and build your audience.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Handle */}
          <div className="space-y-2">
            <Label htmlFor="handle">Channel Handle</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">@</span>
              <Input
                id="handle"
                placeholder="your_channel"
                {...form.register("handle", {
                  onChange: (e) => {
                    e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                  },
                })}
                className="flex-1"
              />
            </div>
            <div className="flex items-center gap-2 text-sm">
              {isChecking && (
                <span className="text-muted-foreground flex items-center gap-1">
                  <IconLoader2 className="h-3 w-3 animate-spin" />
                  Checking...
                </span>
              )}
              {!isChecking && handleAvailable === true && (
                <span className="text-green-500 flex items-center gap-1">
                  <IconCheck className="h-3 w-3" />
                  Available
                </span>
              )}
              {!isChecking && handleAvailable === false && (
                <span className="text-destructive flex items-center gap-1">
                  <IconX className="h-3 w-3" />
                  Taken. Try: <button type="button" className="underline" onClick={() => form.setValue("handle", suggestion)}>{suggestion}</button>
                </span>
              )}
            </div>
            {form.formState.errors.handle && handleAvailable !== false && (
              <p className="text-sm text-destructive">{form.formState.errors.handle.message}</p>
            )}
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Channel Name</Label>
            <Input
              id="displayName"
              placeholder="My Awesome Channel"
              {...form.register("displayName")}
            />
            {form.formState.errors.displayName && (
              <p className="text-sm text-destructive">{form.formState.errors.displayName.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="What's your channel about?"
              rows={3}
              {...form.register("description")}
            />
            {form.formState.errors.description && (
              <p className="text-sm text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full">
            {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Channel
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

