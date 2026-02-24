import { ToastProvider } from "@/components/feedback/ToastProvider";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-zinc-50">
        <div className="container-page">{children}</div>
      </div>
    </ToastProvider>
  );
}
