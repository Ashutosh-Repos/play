"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { updateProfile, type UpdateProfileInput } from "@/app/actions/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";
import { IconLoader2, IconUser } from "@tabler/icons-react";

const profileSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(50, "Max 50 characters"),
  bio: z.string().max(500, "Max 500 characters").optional(),
  avatarUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
});

interface ProfileFormProps {
  defaultValues: {
    displayName: string;
    bio: string;
    avatarUrl: string;
  };
}

export function ProfileForm({ defaultValues }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  });

  const bioValue = form.watch("bio") || "";
  const bioRemaining = 500 - bioValue.length;

  async function onSubmit(data: UpdateProfileInput) {
    startTransition(async () => {
      const result = await updateProfile(data);
      if (result.success) {
        toast.success("Profile updated successfully");
      } else {
        toast.error(result.error || "Failed to update profile");
      }
    });
  }

  function handleAvatarUpload(url: string) {
    form.setValue("avatarUrl", url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconUser className="h-5 w-5" />
          Public Profile
        </CardTitle>
        <CardDescription>This information will be visible to other users.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Avatar Upload */}
          <div className="space-y-2">
            <Label>Profile Picture</Label>
            <div className="flex items-center gap-4">
              <ImageUpload
                type="avatar"
                currentUrl={defaultValues.avatarUrl}
                fallback={defaultValues.displayName}
                onUpload={handleAvatarUpload}
              />
              <div className="text-sm text-muted-foreground">
                <p>Click to upload a new photo</p>
                <p className="text-xs">JPEG, PNG, WebP, or GIF. Max 5MB.</p>
              </div>
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              placeholder="Your display name"
              {...form.register("displayName")}
            />
            {form.formState.errors.displayName && (
              <p className="text-sm text-destructive">{form.formState.errors.displayName.message}</p>
            )}
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="bio">Bio</Label>
              <span className={`text-xs ${bioRemaining < 50 ? "text-destructive" : "text-muted-foreground"}`}>
                {bioRemaining} characters remaining
              </span>
            </div>
            <Textarea
              id="bio"
              placeholder="Tell us about yourself..."
              rows={4}
              {...form.register("bio")}
            />
            {form.formState.errors.bio && (
              <p className="text-sm text-destructive">{form.formState.errors.bio.message}</p>
            )}
          </div>

          {/* Submit */}
          <Button type="submit" disabled={isPending || !form.formState.isDirty}>
            {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
