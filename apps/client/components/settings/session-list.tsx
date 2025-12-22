"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
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
import { 
  IconDeviceDesktop, 
  IconDeviceMobile, 
  IconDeviceTablet,
  IconLoader2, 
  IconLogout,
  IconDevices,
  IconMapPin 
} from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { revokeSession as revokeSessionAction, revokeOtherSessions as revokeOtherSessionsAction } from "@/app/actions/account";

interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
}

interface SessionListProps {
  sessions: Session[];
  currentSessionId?: string | null;
}

function getDeviceInfo(userAgent: string | null): { 
  icon: typeof IconDeviceDesktop; 
  name: string; 
  browser: string;
  os: string;
} {
  if (!userAgent) {
    return { icon: IconDeviceDesktop, name: "Unknown Device", browser: "Unknown", os: "Unknown" };
  }
  
  const ua = userAgent.toLowerCase();
  
  // Device type
  let icon = IconDeviceDesktop;
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
    icon = IconDeviceMobile;
  } else if (ua.includes("ipad") || ua.includes("tablet")) {
    icon = IconDeviceTablet;
  }
  
  // Browser
  let browser = "Browser";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari")) browser = "Safari";
  else if (ua.includes("opera")) browser = "Opera";

  // OS
  let os = "Unknown OS";
  if (ua.includes("windows nt 10")) os = "Windows 10/11";
  else if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os x")) os = "macOS";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("cros")) os = "Chrome OS";

  return { icon, name: `${browser} on ${os}`, browser, os };
}

export function SessionList({ sessions, currentSessionId }: SessionListProps) {
  const [isPending, startTransition] = useTransition();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const router = useRouter();

  async function revokeSession(sessionId: string) {
    setRevokingId(sessionId);
    startTransition(async () => {
      const result = await revokeSessionAction(sessionId);
      if (result.success) {
        toast.success("Session revoked");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to revoke session");
      }
      setRevokingId(null);
    });
  }

  async function revokeAllOthers() {
    startTransition(async () => {
      const result = await revokeOtherSessionsAction();
      if (result.success) {
        toast.success("All other sessions revoked");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to revoke sessions");
      }
    });
  }

  // Use passed currentSessionId, or fallback to most recent session
  const activeSessionId = currentSessionId || sessions[0]?.id;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <IconDevices className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription>
              Devices currently logged into your account.
            </CardDescription>
          </div>
          {sessions.length > 1 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <IconLogout className="h-4 w-4 mr-1" />
                  Sign out all others
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out all other devices?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will sign out from all devices except this one. You'll stay logged in here.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={revokeAllOthers}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign out all
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <IconDevices className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No active sessions</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const device = getDeviceInfo(s.userAgent);
              const DeviceIcon = device.icon;
              const isCurrent = s.id === activeSessionId;
              const isRevoking = revokingId === s.id;
              
              return (
                <div
                  key={s.id}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    isCurrent ? "bg-primary/5 border-primary/20" : "bg-card hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${isCurrent ? "bg-primary/10" : "bg-muted"}`}>
                      <DeviceIcon className={`h-6 w-6 ${isCurrent ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{device.name}</span>
                        {isCurrent && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">
                            This device
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <IconMapPin className="h-3 w-3" />
                          {s.ipAddress || "Unknown IP"}
                        </span>
                        <span>•</span>
                        <span>
                          Active {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeSession(s.id)}
                      disabled={isPending}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {isRevoking ? (
                        <IconLoader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <IconLogout className="h-4 w-4 mr-1" />
                          Sign out
                        </>
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
