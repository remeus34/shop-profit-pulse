import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Orders from "./pages/Orders";
import Listings from "./pages/Listings";
import ProductInsights from "./pages/ProductInsights";
import Shipping from "./pages/Shipping";
import Expenses from "./pages/Expenses";
import Cogs from "./pages/Cogs";
import Ads from "./pages/Ads";
import Research from "./pages/Research";
import Connect from "./pages/Connect";
import Auth from "./pages/Auth";

const queryClient = new QueryClient();


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Index />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/listings" element={<Listings />} />
            <Route path="/insights" element={<ProductInsights />} />
            <Route path="/shipping" element={<Shipping />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/cogs" element={<Cogs />} />
            <Route path="/ads" element={<Ads />} />
            <Route path="/research" element={<Research />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/auth" element={<Auth />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);


export default App;
