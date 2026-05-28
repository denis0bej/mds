import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { LogIn } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { GoogleIcon } from "@/components/GoogleIcon";

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
