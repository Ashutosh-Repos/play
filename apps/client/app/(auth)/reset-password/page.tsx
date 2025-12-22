"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { resetPasswordAction } from "@/actions/auth";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token || "",
      password: "",
      confirmPassword: "",
    },
  });

  // Ensure token is set if it comes in late (though usually searchParams is ready)
  useEffect(() => {
    if (token) {
      form.setValue("token", token);
    }
  }, [token, form]);

  const onSubmit = async (data: ResetPasswordInput) => {
    setIsLoading(true);
    setError("");

    try {
      const result = await resetPasswordAction(data);

      if (!result.success) {
        setError(result.error || "Failed to reset password");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      setError("Something went wrong");
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-red-400 mb-4">Invalid reset link.</p>
        <Link href="/login" className="text-blue-500 hover:text-blue-400">
          Back to login
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-800 text-center">
        <h1 className="text-3xl font-bold text-white mb-4">Password Reset!</h1>
        <p className="text-zinc-400 mb-6">You can now log in with your new password.</p>
        <Link
          href="/login"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-2xl p-8 shadow-2xl border border-zinc-800">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Reset Password</h1>
        <p className="text-zinc-400">Enter your new password</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm text-center">{error}</p>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Hidden token field */}
            <input type="hidden" {...form.register("token")} />

            <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-300">New Password</FormLabel>
                <FormControl>
                  <Input 
                    type="password"
                    placeholder="••••••••" 
                    className="bg-zinc-800 border-zinc-700 text-white" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-zinc-300">Confirm Password</FormLabel>
                <FormControl>
                  <Input 
                    type="password"
                    placeholder="••••••••" 
                    className="bg-zinc-800 border-zinc-700 text-white" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700"
            disabled={isLoading}
          >
            {isLoading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </Form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <Suspense fallback={<div className="text-white">Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
