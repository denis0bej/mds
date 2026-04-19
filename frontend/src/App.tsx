import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import CharacterCreation from "./pages/CharacterCreation";
import AdventureSetup from "./pages/AdventureSetup";
import MapView from "./pages/MapView";
import GameLoop from "./pages/GameLoop";
import AdventureSummary from "./pages/AdventureSummary";
import NotFound from "./pages/NotFound";
import TestAI from "./pages/TestAI";
import { GameProvider } from "@/context/GameContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GameProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<CharacterCreation />} />
              <Route path="/adventure" element={<AdventureSetup />} />
              <Route path="/map" element={<MapView />} />
              <Route path="/game" element={<GameLoop />} />
              <Route path="/summary" element={<AdventureSummary />} />
              <Route path="*" element={<NotFound />} />
              <Route path="/test" element={<TestAI />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </GameProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
