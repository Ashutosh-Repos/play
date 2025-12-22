"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { ImageUpload } from "@/components/ui/image-upload";
import {
  IconUser,
  IconPhoto,
  IconBrandYoutube,
  IconCheck,
  IconArrowRight,
  IconArrowLeft,
  IconSparkles,
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { updateProfile } from "@/app/actions/user";
import { createChannel } from "@/app/actions/channel";
import { toast } from "sonner";

interface OnboardingWizardProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
  };
  hasChannel: boolean;
}

const steps = [
  { id: "welcome", title: "Welcome", icon: IconSparkles },
  { id: "profile", title: "Profile", icon: IconUser },
  { id: "avatar", title: "Avatar", icon: IconPhoto },
  { id: "channel", title: "Channel", icon: IconBrandYoutube },
];

export function OnboardingWizard({ user, hasChannel }: OnboardingWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [bio, setBio] = useState(user.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");

  // Channel state
  const [channelHandle, setChannelHandle] = useState("");
  const [channelName, setChannelName] = useState("");
  const [wantsChannel, setWantsChannel] = useState(!hasChannel);

  const progress = ((currentStep + 1) / steps.length) * 100;

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // Save profile
      await updateProfile({
        displayName,
        bio,
        avatarUrl: avatarUrl || undefined,
      });

      // Create channel if requested
      if (wantsChannel && channelHandle && channelName && !hasChannel) {
        const result = await createChannel({
          handle: channelHandle,
          displayName: channelName,
        });
        if (!result.success) {
          toast.error(result.error || "Failed to create channel");
        }
      }

      toast.success("Welcome aboard! 🎉");
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error("Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-accent/10">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-2 text-sm transition-colors",
                  index <= currentStep ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                    index < currentStep
                      ? "bg-primary text-primary-foreground"
                      : index === currentStep
                      ? "bg-primary/20 text-primary ring-2 ring-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {index < currentStep ? (
                    <IconCheck className="h-4 w-4" />
                  ) : (
                    <step.icon className="h-4 w-4" />
                  )}
                </div>
                <span className="hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        {/* Step Content */}
        <Card className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <IconSparkles className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl">Welcome to Play!</CardTitle>
                <CardDescription className="text-base">
                  Let's set up your profile in just a few steps.
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-muted-foreground mb-6">
                  Hi <strong>{user.displayName || user.username}</strong>! We're excited
                  to have you here. This quick setup will help you get the most out of
                  Play.
                </p>
                <Button onClick={goNext} className="w-full">
                  Get Started
                  <IconArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </>
          )}

          {/* Step 1: Profile */}
          {currentStep === 1 && (
            <>
              <CardHeader>
                <CardTitle>Your Profile</CardTitle>
                <CardDescription>Tell us a bit about yourself.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio (optional)</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="A few words about yourself..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={goBack}>
                    <IconArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button onClick={goNext} className="flex-1">
                    Continue
                    <IconArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Avatar */}
          {currentStep === 2 && (
            <>
              <CardHeader>
                <CardTitle>Profile Picture</CardTitle>
                <CardDescription>Add a photo so people recognize you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                  <Avatar className="h-32 w-32">
                    <AvatarImage src={avatarUrl || undefined} />
                    <AvatarFallback className="text-4xl bg-gradient-to-br from-primary to-accent text-primary-foreground">
                      {displayName?.charAt(0)?.toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <ImageUpload
                    type="avatar"
                    currentUrl={avatarUrl}
                    fallback={displayName}
                    onUpload={setAvatarUrl}
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={goBack}>
                    <IconArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button variant="ghost" onClick={goNext} className="text-muted-foreground">
                    Skip
                  </Button>
                  <Button onClick={goNext} className="flex-1">
                    Continue
                    <IconArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 3: Channel */}
          {currentStep === 3 && (
            <>
              <CardHeader>
                <CardTitle>Create a Channel?</CardTitle>
                <CardDescription>
                  {hasChannel
                    ? "You already have a channel!"
                    : "Start your creator journey by creating a channel."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasChannel ? (
                  <>
                    <div className="flex gap-3">
                      <Button
                        variant={wantsChannel ? "default" : "outline"}
                        onClick={() => setWantsChannel(true)}
                        className="flex-1"
                      >
                        Yes, create one
                      </Button>
                      <Button
                        variant={!wantsChannel ? "default" : "outline"}
                        onClick={() => setWantsChannel(false)}
                        className="flex-1"
                      >
                        Maybe later
                      </Button>
                    </div>

                    {wantsChannel && (
                      <div className="space-y-4 pt-4 animate-in fade-in duration-300">
                        <div className="space-y-2">
                          <Label htmlFor="channelHandle">Channel Handle</Label>
                          <div className="flex">
                            <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 bg-muted text-muted-foreground text-sm">
                              @
                            </span>
                            <Input
                              id="channelHandle"
                              value={channelHandle}
                              onChange={(e) => setChannelHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                              placeholder="yourhandle"
                              className="rounded-l-none"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="channelName">Channel Name</Label>
                          <Input
                            id="channelName"
                            value={channelName}
                            onChange={(e) => setChannelName(e.target.value)}
                            placeholder="My Awesome Channel"
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    You're all set with your channel! ✨
                  </p>
                )}

                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={goBack}>
                    <IconArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={handleComplete}
                    disabled={isLoading || (wantsChannel && !hasChannel && (!channelHandle || !channelName))}
                    className="flex-1"
                  >
                    {isLoading ? "Saving..." : "Complete Setup"}
                    <IconCheck className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>

        {/* Skip link */}
        {currentStep > 0 && currentStep < 3 && (
          <div className="text-center mt-4">
            <Button variant="link" onClick={() => setCurrentStep(3)} className="text-muted-foreground">
              Skip to finish
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
