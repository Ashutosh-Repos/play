"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { IconBrandGoogle, IconBrandGithub, IconBrandDiscord, IconLoader2, IconUnlink, IconLink } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";

interface Connection {
  id: string;
  provider: string;
  createdAt: Date;
}

interface OAuthConnectionsProps {
  connections: Connection[];
  hasPassword: boolean;
}

const providerConfig: Record<string, { icon: typeof IconBrandGoogle; label: string; color: string }> = {
  google: { icon: IconBrandGoogle, label: "Google", color: "text-red-500" },
  github: { icon: IconBrandGithub, label: "GitHub", color: "" },
  discord: { icon: IconBrandDiscord, label: "Discord", color: "text-indigo-500" },
};

export function OAuthConnections({ connections, hasPassword }: OAuthConnectionsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const connectedProviders = connections.map((c) => c.provider.toLowerCase());
  const availableProviders = Object.keys(providerConfig).filter(
    (p) => !connectedProviders.includes(p)
  );

  const canUnlink = hasPassword || connections.length > 1;

  async function unlinkProvider(provider: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/account/connections/${provider}`, {
          method: "DELETE",
        });
        if (res.ok) {
          toast.success(`${providerConfig[provider]?.label || provider} disconnected`);
          router.refresh();
        } else {
          const data = await res.json();
          toast.error(data.error?.message || "Failed to disconnect");
        }
      } catch {
        toast.error("Failed to disconnect");
      }
    });
  }

  async function connectProvider(provider: string) {
    startTransition(async () => {
      try {
        // Use Next-Auth signIn to link additional provider
        await signIn(provider, { callbackUrl: "/settings/sessions" });
      } catch {
        toast.error("Failed to connect");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconLink className="h-5 w-5" />
          Connected Accounts
        </CardTitle>
        <CardDescription>
          Manage your linked social accounts for sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connected accounts */}
        {connections.length > 0 ? (
          <div className="space-y-3">
            {connections.map((connection) => {
              const provider = connection.provider.toLowerCase();
              const config = providerConfig[provider] || {
                icon: IconBrandGoogle,
                label: connection.provider,
                color: "",
              };
              const Icon = config.icon;

              return (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full bg-muted ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{config.label}</span>
                        <Badge variant="outline" className="text-xs">
                          Connected
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Linked {formatDistanceToNow(new Date(connection.createdAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  
                  {canUnlink ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <IconUnlink className="h-4 w-4 mr-1" />
                          Disconnect
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Disconnect {config.label}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            You won&apos;t be able to sign in with {config.label} anymore.
                            {!hasPassword && connections.length <= 2 && (
                              <span className="block mt-2 text-destructive font-medium">
                                ⚠️ Set a password first to avoid losing access to your account.
                              </span>
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => unlinkProvider(provider)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Disconnect
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <span className="text-xs text-muted-foreground px-2">
                      Set a password to disconnect
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <IconLink className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No connected accounts</p>
          </div>
        )}

        {/* Available providers to connect */}
        {availableProviders.length > 0 && (
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-3">
              Link more accounts for easier sign-in:
            </p>
            <div className="flex flex-wrap gap-2">
              {availableProviders.map((provider) => {
                const config = providerConfig[provider]!;
                const Icon = config.icon;
                return (
                  <Button 
                    key={provider} 
                    variant="outline" 
                    size="sm"
                    onClick={() => connectProvider(provider)}
                    disabled={isPending}
                  >
                    <Icon className={`h-4 w-4 mr-2 ${config.color}`} />
                    Connect {config.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
