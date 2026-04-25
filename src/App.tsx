import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/app/Dashboard";
import Payments from "./pages/app/Payments";
import Beneficiaries from "./pages/app/Beneficiaries";
import AutoPay from "./pages/app/AutoPay";
import CardPage from "./pages/app/CardPage";
import Loans from "./pages/app/Loans";
import FixedDeposits from "./pages/app/FixedDeposits";
import Policies from "./pages/app/Policies";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="payments" element={<Payments />} />
              <Route path="beneficiaries" element={<Beneficiaries />} />
              <Route path="autopay" element={<AutoPay />} />
              <Route path="card" element={<CardPage />} />
              <Route path="loans" element={<Loans />} />
              <Route path="fd" element={<FixedDeposits />} />
              <Route path="policies" element={<Policies />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
