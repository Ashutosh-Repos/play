"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTransition, useState } from "react";
import { changePassword, setPassword } from "@/app/actions/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { IconLoader2, IconCheck, IconLock } from "@tabler/icons-react";

const setPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

interface PasswordFormProps {
  hasPassword: boolean;
}

function PasswordStrengthIndicator({ password }: { password: string }) {
  const hasLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const checks = [
    { label: "At least 8 characters", met: hasLength },
    { label: "One uppercase letter", met: hasUppercase },
    { label: "One number", met: hasNumber },
    { label: "One special character", met: hasSpecial },
  ];

  return (
    <div className="text-xs space-y-1 mt-2">
      {checks.map((check) => (
        <div
          key={check.label}
          className={`flex items-center gap-1 ${check.met ? "text-green-500" : "text-muted-foreground"}`}
        >
          {check.met && <IconCheck className="h-3 w-3" />}
          <span>{check.label}</span>
        </div>
      ))}
    </div>
  );
}

export function PasswordForm({ hasPassword }: PasswordFormProps) {
  const [isPending, startTransition] = useTransition();
  const [showSetForm, setShowSetForm] = useState(false);

  // Set Password Form (for OAuth users)
  const setForm = useForm({
    resolver: zodResolver(setPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  // Change Password Form (for users with existing password)
  const changeForm = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  const setPasswordValue = setForm.watch("newPassword");
  const changePasswordValue = changeForm.watch("newPassword");

  async function onSetPassword(data: { newPassword: string }) {
    startTransition(async () => {
      const result = await setPassword({ password: data.newPassword });
      if (result.success) {
        toast.success("Password set successfully! You can now log in with email.");
        setForm.reset();
        setShowSetForm(false);
      } else {
        toast.error(result.error || "Failed to set password");
      }
    });
  }

  async function onChangePassword(data: { currentPassword: string; newPassword: string }) {
    startTransition(async () => {
      const result = await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      if (result.success) {
        toast.success("Password changed successfully");
        changeForm.reset();
      } else {
        toast.error(result.error || "Failed to change password");
      }
    });
  }

  // OAuth user without password
  if (!hasPassword) {
    if (!showSetForm) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <IconLock className="h-5 w-5" />
              Password
            </CardTitle>
            <CardDescription>
              You signed up with a social account. Set a password to enable email login.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowSetForm(true)}>
              Set Password
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconLock className="h-5 w-5" />
            Set Password
          </CardTitle>
          <CardDescription>
            Create a password to log in with your email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={setForm.handleSubmit(onSetPassword)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="set-newPassword">New Password</Label>
              <Input
                id="set-newPassword"
                type="password"
                placeholder="Enter a strong password"
                {...setForm.register("newPassword")}
              />
              <PasswordStrengthIndicator password={setPasswordValue} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="set-confirmPassword">Confirm Password</Label>
              <Input
                id="set-confirmPassword"
                type="password"
                placeholder="Confirm your password"
                {...setForm.register("confirmPassword")}
              />
              {setForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {setForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set Password
              </Button>
              <Button type="button" variant="ghost" onClick={() => setShowSetForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  // User with existing password
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconLock className="h-5 w-5" />
          Change Password
        </CardTitle>
        <CardDescription>Update your password to keep your account secure.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={changeForm.handleSubmit(onChangePassword)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current Password</Label>
            <Input
              id="currentPassword"
              type="password"
              placeholder="Enter current password"
              {...changeForm.register("currentPassword")}
            />
            {changeForm.formState.errors.currentPassword && (
              <p className="text-sm text-destructive">
                {changeForm.formState.errors.currentPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              placeholder="Enter new password"
              {...changeForm.register("newPassword")}
            />
            <PasswordStrengthIndicator password={changePasswordValue} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              {...changeForm.register("confirmPassword")}
            />
            {changeForm.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {changeForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
