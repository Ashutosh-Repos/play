"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition } from "react";
import { updateChannel, type UpdateChannelInput } from "@/app/actions/channel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ImageUpload } from "@/components/ui/image-upload";
import { toast } from "sonner";
import { IconLoader2, IconPlus, IconTrash, IconLink, IconBrandYoutube } from "@tabler/icons-react";

const updateChannelSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(50, "Max 50 characters"),
  description: z.string().max(1000, "Max 1000 characters").optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  location: z.string().max(100).optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  links: z
    .array(
      z.object({
        title: z.string().max(50),
        url: z.string().url(),
      })
    )
    .max(10)
    .optional(),
});

interface ChannelFormProps {
  defaultValues: {
    handle: string;
    displayName: string;
    description: string;
    avatarUrl: string;
    bannerUrl: string;
    location: string;
    contactEmail: string;
    links: { title: string; url: string }[];
  };
}

export function ChannelForm({ defaultValues }: ChannelFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<UpdateChannelInput>({
    resolver: zodResolver(updateChannelSchema),
    defaultValues: {
      displayName: defaultValues.displayName,
      description: defaultValues.description,
      avatarUrl: defaultValues.avatarUrl,
      bannerUrl: defaultValues.bannerUrl,
      location: defaultValues.location,
      contactEmail: defaultValues.contactEmail,
      links: defaultValues.links.length > 0 ? defaultValues.links : [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "links",
  });

  const descriptionValue = form.watch("description") || "";
  const descriptionRemaining = 1000 - descriptionValue.length;

  async function onSubmit(data: UpdateChannelInput) {
    startTransition(async () => {
      const result = await updateChannel(data);
      if (result.success) {
        toast.success("Channel updated successfully");
      } else {
        toast.error(result.error || "Failed to update channel");
      }
    });
  }

  function handleAvatarUpload(url: string) {
    form.setValue("avatarUrl", url, { shouldDirty: true });
  }

  function handleBannerUpload(url: string) {
    form.setValue("bannerUrl", url, { shouldDirty: true });
  }

  return (
    <div className="space-y-6">
      {/* Branding */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconBrandYoutube className="h-5 w-5" />
            Channel Branding
          </CardTitle>
          <CardDescription>Customize how your channel looks to viewers.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Banner Upload */}
            <div className="space-y-2">
              <Label>Banner Image</Label>
              <ImageUpload
                type="channel-banner"
                currentUrl={defaultValues.bannerUrl}
                onUpload={handleBannerUpload}
              />
            </div>

            {/* Avatar Upload */}
            <div className="space-y-2">
              <Label>Channel Picture</Label>
              <div className="flex items-center gap-4">
                <ImageUpload
                  type="channel-avatar"
                  currentUrl={defaultValues.avatarUrl}
                  fallback={defaultValues.displayName}
                  onUpload={handleAvatarUpload}
                />
                <div className="text-sm text-muted-foreground">
                  <p>Click to upload</p>
                  <p className="text-xs">Recommended: 800×800</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Basic Info */}
            <div className="space-y-2">
              <Label htmlFor="displayName">Channel Name</Label>
              <Input
                id="displayName"
                {...form.register("displayName")}
              />
              {form.formState.errors.displayName && (
                <p className="text-sm text-destructive">{form.formState.errors.displayName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="description">Description</Label>
                <span className={`text-xs ${descriptionRemaining < 100 ? "text-destructive" : "text-muted-foreground"}`}>
                  {descriptionRemaining} remaining
                </span>
              </div>
              <Textarea
                id="description"
                rows={4}
                {...form.register("description")}
              />
            </div>

            <Separator />

            {/* Contact Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="New York, USA"
                  {...form.register("location")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Business Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  placeholder="business@example.com"
                  {...form.register("contactEmail")}
                />
              </div>
            </div>

            <Separator />

            {/* Social Links */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Social Links</Label>
                  <p className="text-xs text-muted-foreground">Add up to 10 links</p>
                </div>
                {fields.length < 10 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ title: "", url: "" })}
                  >
                    <IconPlus className="h-4 w-4 mr-1" />
                    Add Link
                  </Button>
                )}
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <IconLink className="h-5 w-5 text-muted-foreground mt-2.5 shrink-0" />
                  <Input
                    placeholder="Title (e.g. Twitter)"
                    {...form.register(`links.${index}.title`)}
                    className="w-32"
                  />
                  <Input
                    placeholder="https://..."
                    {...form.register(`links.${index}.url`)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                  >
                    <IconTrash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}

              {fields.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No links added yet
                </p>
              )}
            </div>

            <Button type="submit" disabled={isPending || !form.formState.isDirty}>
              {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Channel Info */}
      <Card className="border-muted">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Channel Handle</span>
            <span className="font-mono">@{defaultValues.handle}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
