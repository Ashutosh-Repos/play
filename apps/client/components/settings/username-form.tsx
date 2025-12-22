"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { updateUsername } from "@/app/actions/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { IconLoader2, IconClock } from "@tabler/icons-react";

const usernameSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers, and underscores"),
});

interface UsernameFormProps {
  currentUsername: string;
  cooldownUntil: Date | null;
}

export function UsernameForm({ currentUsername, cooldownUntil }: UsernameFormProps) {
  const [isPending, startTransition] = useTransition();
  const isOnCooldown = cooldownUntil && cooldownUntil > new Date();

  const form = useForm({
    resolver: zodResolver(usernameSchema),
    defaultValues: { username: currentUsername },
  });

  async function onSubmit(data: { username: string }) {
    startTransition(async () => {
      const result = await updateUsername(data);
      if (result.success) {
        toast.success("Username updated successfully");
      } else {
        toast.error(result.error || "Failed to update username");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Username</CardTitle>
        <CardDescription>
          Your unique @handle. Can only be changed once every 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isOnCooldown ? (
          <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted rounded-md">
            <IconClock className="h-5 w-5" />
            <span>
              Next change available: {cooldownUntil?.toLocaleDateString()}
            </span>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="flex gap-2">
                <span className="flex items-center text-muted-foreground">@</span>
                <Input
                  id="username"
                  placeholder="username"
                  {...form.register("username")}
                  className="flex-1"
                />
              </div>
              {form.formState.errors.username && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.username.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={isPending}>
              {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Username
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
