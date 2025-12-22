"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createChannel, type CreateChannelInput } from "@/app/actions/channel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { IconLoader2, IconBrandYoutube } from "@tabler/icons-react";

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
  const router = useRouter();

  const form = useForm<CreateChannelInput>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: { handle: "", displayName: "", description: "" },
  });

  async function onSubmit(data: CreateChannelInput) {
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
                {...form.register("handle")}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will be your unique channel URL. Choose wisely!
            </p>
            {form.formState.errors.handle && (
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

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Channel
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
