import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  ScrollText,
  Settings,
  LogOut,
  Package,
  Tags,
  Warehouse,
  Boxes,
  Wallet,
  Landmark,
  Truck,
  Menu,
  X,
  ShoppingCart,
  ShoppingBag,
  Receipt,
  Undo2,
  FileBarChart,
  ArrowLeftRight,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { NotificationBell } from "@/components/notification-bell";

interface NavItem {
  path: string;
  label: string;
  icon: ReactNode;
  permission?: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: "/dashboard", label: "لوحة التحكم", icon: <LayoutDashboard size={20} /> },
  { path: "/pos", label: "نقطة البيع", icon: <ShoppingCart size={20} />, permission: "sales.create" },
  { path: "/sales", label: "سجل المبيعات", icon: <Receipt size={20} />, permission: "sales.view" },
  { path: "/sales-returns", label: "مرتجعات المبيعات", icon: <Undo2 size={20} />, permission: "sales.return" },
  { path: "/purchases", label: "المشتريات", icon: <ShoppingBag size={20} />, permission: "purchases.view" },
  { path: "/purchase-returns", label: "مرتجعات المشتريات", icon: <Undo2 size={20} />, permission: "purchases.return" },
  { path: "/products", label: "المنتجات", icon: <Package size={20} />, permission: "products.view" },
  { path: "/master-data", label: "البيانات الأساسية", icon: <Tags size={20} />, permission: "products.view" },
  { path: "/warehouses", label: "المخازن", icon: <Warehouse size={20} />, permission: "inventory.view" },
  { path: "/stock", label: "المخزون", icon: <Boxes size={20} />, permission: "inventory.view" },
  { path: "/movements", label: "حركات المخزون", icon: <ScrollText size={20} />, permission: "inventory.view" },
  { path: "/transfers", label: "التحويلات المخزنية", icon: <ArrowLeftRight size={20} />, permission: "inventory.view" },
  { path: "/stock-counts", label: "الجرد المخزني", icon: <ClipboardList size={20} />, permission: "inventory.view" },
  { path: "/customers", label: "العملاء", icon: <Users size={20} />, permission: "customers.view" },
  { path: "/suppliers", label: "الموردون", icon: <Truck size={20} />, permission: "suppliers.view" },
  { path: "/treasury", label: "الخزينة", icon: <Wallet size={20} />, permission: "treasury.view" },
  { path: "/finance", label: "الشؤون المالية", icon: <Landmark size={20} />, permission: "finance.view" },
  { path: "/reports", label: "التقارير", icon: <FileBarChart size={20} />, permission: "reports.view" },
  { path: "/users", label: "المستخدمون", icon: <Users size={20} />, permission: "users.view" },
  { path: "/roles", label: "الأدوار والصلاحيات", icon: <ShieldCheck size={20} />, permission: "roles.view" },
  { path: "/audit", label: "سجل النشاط", icon: <ScrollText size={20} />, permission: "audit.view" },
  { path: "/settings", label: "الإعدادات", icon: <Settings size={20} />, permission: "settings.view" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "؟") + (parts[1]?.[0] ?? "");
}

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, hasPermission } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  const sidebar = (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full shrink-0 shadow-xl">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center shrink-0 shadow-inner">
          <Package size={24} className="text-slate-900" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white truncate">
            {user?.storeName ?? "نظام نقاط البيع"}
          </h1>
          <p className="text-xs text-slate-400">نقاط البيع</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-3">
          {visibleItems.map((item) => {
            const active = location === item.path;
            return (
              <li key={item.path}>
                <Link
                  href={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    active
                      ? "bg-amber-500 text-slate-900 font-bold shadow-md shadow-amber-500/20"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white font-medium"
                  }`}
                  data-testid={`nav-${item.path.slice(1)}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="w-9 h-9 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold">
            {user ? initials(user.fullName) : "؟"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {user?.fullName ?? ""}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {user?.role.nameAr ?? user?.role.name ?? ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => void logout()}
          className="flex items-center gap-3 px-4 py-2.5 w-full rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors font-medium"
          data-testid="button-logout"
        >
          <LogOut size={18} />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <div className="hidden lg:flex">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full">{sidebar}</div>
        </div>
      )}

      <main className="flex-1 h-full overflow-hidden flex flex-col bg-slate-50">
        <header className="flex items-center justify-between p-3 lg:px-6 bg-white border-b border-slate-200">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="p-2 rounded-lg hover:bg-slate-100 lg:hidden"
              data-testid="button-menu-toggle"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            <span className="font-bold lg:hidden">
              {user?.storeName ?? "نقاط البيع"}
            </span>
          </div>
          <NotificationBell />
        </header>
        {children}
      </main>
    </div>
  );
}
