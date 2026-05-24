import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";

const createAccountSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters.")
      .max(32, "Username must be at most 32 characters.")
      .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers, and underscores."),
    email: z.string().email("Please enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().min(1, "Please confirm your password."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type CreateAccountFormValues = z.infer<typeof createAccountSchema>;

export default function CreateAccount() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateAccountFormValues>({
    resolver: zodResolver(createAccountSchema),
  });

  const onSubmit = async (data: CreateAccountFormValues) => {
    setSubmitError(null);
    try {
      await registerUser(data.username, data.email, data.password);
      navigate("/");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not create account.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-md mx-auto"
    >
      <div className="auth-form-panel">
        <div className="flex items-center gap-3 mb-6">
          <UserPlus className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display text-primary text-gold-glow tracking-wider">
            Create Account
          </h1>
        </div>

        <p className="text-muted-foreground font-body mb-6">
          Create an account to save your single-player adventure progress.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="block font-display text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Username
            </label>
            <Input
              autoComplete="username"
              className="bg-input border-gold rounded-md"
              {...register("username")}
            />
            {errors.username && (
              <p className="text-destructive text-sm mt-1">{errors.username.message}</p>
            )}
          </div>

          <div>
            <label className="block font-display text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Email
            </label>
            <Input
              type="email"
              autoComplete="email"
              className="bg-input border-gold rounded-md"
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
              autoComplete="new-password"
              className="bg-input border-gold rounded-md"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-destructive text-sm mt-1">{errors.password.message}</p>
            )}
          </div>

          <div>
            <label className="block font-display text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Confirm Password
            </label>
            <Input
              type="password"
              autoComplete="new-password"
              className="bg-input border-gold rounded-md"
              {...register("confirmPassword")}
            />
            {errors.confirmPassword && (
              <p className="text-destructive text-sm mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          {submitError && <p className="text-destructive text-sm">{submitError}</p>}

          <button type="submit" disabled={isSubmitting} className="btn-create-account">
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="text-sm text-muted-foreground mt-6 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
