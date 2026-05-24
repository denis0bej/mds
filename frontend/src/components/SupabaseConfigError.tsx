import { BookOpen } from "lucide-react";

export function SupabaseConfigError() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
      <div className="flex items-center gap-3 mb-8">
        <BookOpen className="h-8 w-8 text-primary" />
        <h1 className="font-display text-2xl text-primary text-gold-glow tracking-widest">
          The Eldritch Archive
        </h1>
      </div>
      <div className="auth-form-panel max-w-lg text-center">
        <h2 className="font-display text-lg text-primary mb-3">Frontend not configured</h2>
        <p className="text-muted-foreground font-body text-sm mb-4">
          Missing Supabase keys in <code className="text-primary">frontend/.env</code>.
          Add your project URL and the <strong>anon public</strong> key (not the service role key).
        </p>
        <pre className="text-left text-xs bg-muted/40 border border-gold rounded-md p-4 font-mono text-foreground overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key`}
        </pre>
        <p className="text-xs text-muted-foreground mt-4 font-body">
          Supabase Dashboard → Project Settings → API → anon public. Ask a teammate if you do not have access.
        </p>
      </div>
    </div>
  );
}
