import { ThemeToggle } from "@/components/custom/theme-toggle";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <ThemeToggle className="absolute top-4 right-4"/>
      {children}
    </div>
  );
}
