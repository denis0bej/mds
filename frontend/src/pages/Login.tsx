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

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
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
