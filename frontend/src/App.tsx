import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { AuthLayout } from "@/components/AuthLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { GuestRoute } from "@/components/GuestRoute";
import CharacterCreation from "./pages/CharacterCreation";
import AdventureSetup from "./pages/AdventureSetup";
import MapView from "./pages/MapView";
import GameLoop from "./pages/GameLoop";
import AdventureSummary from "./pages/AdventureSummary";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import CreateAccount from "./pages/CreateAccount";
import Account from "./pages/Account";
import { GameProvider } from "@/context/GameContext";
import { AuthProvider } from "@/context/AuthContext";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SupabaseConfigError } from "@/components/SupabaseConfigError";

const App = () => {
  if (!isSupabaseConfigured) {
    return <SupabaseConfigError />;
  }

  return (
    <TooltipProvider>
      <AuthProvider>
        <GameProvider>
          <Toaster />
          <BrowserRouter>
            <Routes>
              <Route element={<GuestRoute />}>
                <Route element={<AuthLayout />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/create-account" element={<CreateAccount />} />
                </Route>
              </Route>

              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<CharacterCreation />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/adventure" element={<AdventureSetup />} />
                  <Route path="/map" element={<MapView />} />
                  <Route path="/game" element={<GameLoop />} />
                  <Route path="/summary" element={<AdventureSummary />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </BrowserRouter>
        </GameProvider>
      </AuthProvider>
    </TooltipProvider>
  );
};

export default App;
