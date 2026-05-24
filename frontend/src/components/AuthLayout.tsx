import { Outlet } from "react-router-dom";
import { BookOpen } from "lucide-react";

export function AuthLayout() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="flex items-center gap-3 mb-8">
        <BookOpen className="h-8 w-8 text-primary" />
        <h1 className="font-display text-2xl text-primary text-gold-glow tracking-widest">
          The Eldritch Archive
        </h1>
      </div>
      <Outlet />
    </div>
  );
}
