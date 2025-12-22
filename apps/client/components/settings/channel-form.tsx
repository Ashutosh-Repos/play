"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { updateChannel, deleteChannel, type UpdateChannelInput } from "@/app/actions/channel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ImageUpload } from "@/components/ui/image-upload";
import { ChannelPreview } from "./channel-preview";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { IconLoader2, IconPlus, IconTrash, IconLink, IconBrandYoutube, IconAlertTriangle } from "@tabler/icons-react";

// Delete channel button with confirmation
function DeleteChannelButton({ handle }: { handle: string }) {
  const [isPending, startTransition] = useTransition();
  const [confirmHandle, setConfirmHandle] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const canDelete = confirmHandle === handle;

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteChannel();
      if (result.success) {
        toast.success("Channel deleted successfully");
        setOpen(false);
        router.push("/settings/channel");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to delete channel");
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <IconTrash className="mr-2 h-4 w-4" />
          Delete Channel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <IconAlertTriangle className="h-5 w-5 text-destructive" />
            Delete Channel
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3">
            <p>
              This action <strong>cannot be undone</strong>. This will permanently delete your
              channel <strong>@{handle}</strong> and remove all videos, subscribers, and data.
            </p>
            <div className="space-y-2">
              <Label htmlFor="confirmHandle" className="text-foreground">
                Type <strong>@{handle}</strong> to confirm:
              </Label>
              <Input
                id="confirmHandle"
                value={confirmHandle}
                onChange={(e) => setConfirmHandle(e.target.value.replace("@", ""))}
                placeholder={handle}
                className="font-mono"
              />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || isPending}
          >
            {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Channel
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

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

  // Watch form values for live preview
  const watchedValues = form.watch();
  const descriptionValue = watchedValues.description || "";
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
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main Form - Takes 2 columns */}
      <div className="lg:col-span-2 space-y-6">
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

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible and destructive actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete this channel</p>
              <p className="text-sm text-muted-foreground">
                Once deleted, all videos and subscribers will be permanently removed.
              </p>
            </div>
            <DeleteChannelButton handle={defaultValues.handle} />
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Preview Sidebar - Hidden on mobile */}
      <div className="hidden lg:block">
        <div className="sticky top-20">
          <ChannelPreview
            displayName={watchedValues.displayName || defaultValues.displayName}
            handle={defaultValues.handle}
            description={watchedValues.description}
            avatarUrl={watchedValues.avatarUrl || defaultValues.avatarUrl}
            bannerUrl={watchedValues.bannerUrl || defaultValues.bannerUrl}
          />
        </div>
      </div>
    </div>
  );
}
