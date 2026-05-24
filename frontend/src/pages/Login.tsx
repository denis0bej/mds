import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

const GoogleIcon = () => (
  <svg className="h-4 w-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { login, loginWithGoogle } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setSubmitError(null);
    try {
      await login(data.email, data.password);
      navigate("/");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Login failed.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md mx-auto"
    >
      <div className="narrative-panel">
        <div className="flex items-center gap-3 mb-6">
          <LogIn className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display text-primary text-gold-glow tracking-wider">
            Log In
          </h1>
        </div>

        <p className="text-muted-foreground font-body mb-6">
          Sign in to save your adventure and continue where you left off.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block font-display text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Email
            </label>
            <Input
              type="email"
              autoComplete="email"
              className="bg-input border-gold"
              {...register("email")}
            />
            {errors.email && (
              <p className="text-destructive text-sm mt-1">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block font-display text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Password
            </label>
            <Input
              type="password"
              autoComplete="current-password"
              className="bg-input border-gold"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-destructive text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          {submitError && <p className="text-destructive text-sm">{submitError}</p>}

          <button type="submit" disabled={isSubmitting} className="btn-fantasy w-full disabled:opacity-50">
            {isSubmitting ? "Signing in..." : "Log In"}
          </button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gold/20" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground font-display uppercase tracking-widest">or</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loginWithGoogle()}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gold/40 rounded-sm bg-card hover:bg-gold/5 transition-colors font-display text-sm tracking-wider text-foreground"
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          No account yet?{" "}
          <Link to="/create-account" className="text-primary hover:underline">
            Create account
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
