import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-lg mx-auto"
    >
      <div className="narrative-panel">
        <div className="flex items-center gap-3 mb-6">
          <User className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-display text-primary text-gold-glow tracking-wider">
            Account Details
          </h1>
        </div>

        <dl className="space-y-5">
          <div>
            <dt className="font-display text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Username
            </dt>
            <dd className="text-foreground font-body text-lg">{user.username}</dd>
          </div>

          <div>
            <dt className="font-display text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Email
            </dt>
            <dd className="text-foreground font-body text-lg">{user.email}</dd>
          </div>

          <div>
            <dt className="font-display text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Member since
            </dt>
            <dd className="text-foreground font-body text-lg">{formatDate(user.created_at)}</dd>
          </div>
        </dl>

        <div className="mt-8 pt-6 border-t border-gold">
          <button type="button" onClick={handleLogout} className="btn-fantasy w-full">
            <span className="inline-flex items-center justify-center gap-2">
              <LogOut className="h-4 w-4" />
              Log Out
            </span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
