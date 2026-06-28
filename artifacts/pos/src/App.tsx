import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useGetSetupStatus } from "@workspace/api-client-react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { LoginPage } from "@/pages/login";
import { SetupPage } from "@/pages/setup";
import { DashboardPage } from "@/pages/dashboard";
import { UsersPage } from "@/pages/users";
import { RolesPage } from "@/pages/roles";
import { AuditPage } from "@/pages/audit";
import { ProductsPage } from "@/pages/products";
import { MasterDataPage } from "@/pages/master-data";
import { WarehousesPage } from "@/pages/warehouses";
import { StockPage } from "@/pages/stock";
import { MovementsPage } from "@/pages/movements";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});

function FullScreenLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <Loader2 size={40} className="text-amber-500 animate-spin" />
    </div>
  );
}

function PermissionGate({
  permission,
  children,
}: {
  permission: string;
  children: React.ReactNode;
}) {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return <Redirect to="/dashboard" />;
  }
  return <>{children}</>;
}

function AuthenticatedApp() {
  return (
    <AppShell>
      <Switch>
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/products">
          <PermissionGate permission="products.view">
            <ProductsPage />
          </PermissionGate>
        </Route>
        <Route path="/master-data">
          <PermissionGate permission="products.view">
            <MasterDataPage />
          </PermissionGate>
        </Route>
        <Route path="/warehouses">
          <PermissionGate permission="inventory.view">
            <WarehousesPage />
          </PermissionGate>
        </Route>
        <Route path="/stock">
          <PermissionGate permission="inventory.view">
            <StockPage />
          </PermissionGate>
        </Route>
        <Route path="/movements">
          <PermissionGate permission="inventory.view">
            <MovementsPage />
          </PermissionGate>
        </Route>
        <Route path="/users">
          <PermissionGate permission="users.view">
            <UsersPage />
          </PermissionGate>
        </Route>
        <Route path="/roles">
          <PermissionGate permission="roles.view">
            <RolesPage />
          </PermissionGate>
        </Route>
        <Route path="/audit">
          <PermissionGate permission="audit.view">
            <AuditPage />
          </PermissionGate>
        </Route>
        <Route path="/" component={() => <Redirect to="/dashboard" />} />
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function Gateway() {
  const setupStatus = useGetSetupStatus();
  const { user, isLoading: authLoading } = useAuth();

  if (setupStatus.isLoading) return <FullScreenLoader />;

  if (setupStatus.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <h1 className="text-xl font-bold text-slate-800 mb-2">
            تعذّر الاتصال بالخادم
          </h1>
          <p className="text-slate-500">
            يرجى التأكد من تشغيل الخادم ثم إعادة تحميل الصفحة.
          </p>
        </div>
      </div>
    );
  }

  if (!setupStatus.data?.isSetupComplete) {
    return <SetupPage />;
  }

  if (authLoading) return <FullScreenLoader />;

  if (!user) return <LoginPage />;

  return <AuthenticatedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Gateway />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
