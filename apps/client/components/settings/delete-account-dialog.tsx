"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/actions/user";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { IconLoader2, IconTrash, IconAlertTriangle } from "@tabler/icons-react";

interface DeleteAccountDialogProps {
  hasPassword: boolean;
}

export function DeleteAccountDialog({ hasPassword }: DeleteAccountDialogProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  const isConfirmed = confirmation === "DELETE";

  async function handleDelete() {
    startTransition(async () => {
      const result = await deleteAccount(hasPassword ? password : undefined);
      if (result.success) {
        toast.success("Account scheduled for deletion. You have 30 days to recover.");
        setOpen(false);
        // Sign out after deletion
        await signOut({ callbackUrl: "/" });
      } else {
        toast.error(result.error || "Failed to delete account");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <IconTrash className="mr-2 h-4 w-4" />
          Delete Account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <IconAlertTriangle className="h-5 w-5" />
            Delete Account
          </DialogTitle>
          <DialogDescription>
            This action will schedule your account for permanent deletion. You have 30 days to
            recover your account before all data is permanently removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="delete-password">Enter your password</Label>
              <Input
                id="delete-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Type <span className="font-mono font-bold">DELETE</span> to confirm
            </Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmed || isPending || (hasPassword && !password)}
          >
            {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete My Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
