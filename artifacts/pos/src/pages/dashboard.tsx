import { Link } from "wouter";
import {
  Users,
  ShieldCheck,
  ScrollText,
  ArrowLeft,
  Activity,
} from "lucide-react";
import {
  useListUsers,
  useListRoles,
  useListAuditLogs,
  getListUsersQueryKey,
  getListRolesQueryKey,
  getListAuditLogsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

const USERS_PARAMS = { page: 1, pageSize: 1, includeInactive: true } as const;
const AUDIT_PARAMS = { page: 1, pageSize: 6 } as const;

export function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const canViewUsers = hasPermission("users.view");
  const canViewRoles = hasPermission("roles.view");
  const canViewAudit = hasPermission("audit.view");

  const usersQuery = useListUsers(USERS_PARAMS, {
    query: {
      enabled: canViewUsers,
      queryKey: getListUsersQueryKey(USERS_PARAMS),
    },
  });
  const rolesQuery = useListRoles({
    query: { enabled: canViewRoles, queryKey: getListRolesQueryKey() },
  });
  const auditQuery = useListAuditLogs(AUDIT_PARAMS, {
    query: {
      enabled: canViewAudit,
      queryKey: getListAuditLogsQueryKey(AUDIT_PARAMS),
    },
  });

  const stats = [
    {
      label: "إجمالي المستخدمين",
      value: usersQuery.data?.total ?? 0,
      icon: <Users className="text-blue-600" size={24} />,
      bg: "bg-blue-100 border-blue-200",
      href: "/users",
      visible: canViewUsers,
    },
    {
      label: "الأدوار المعرّفة",
      value: rolesQuery.data?.length ?? 0,
      icon: <ShieldCheck className="text-amber-600" size={24} />,
      bg: "bg-amber-100 border-amber-200",
      href: "/roles",
      visible: canViewRoles,
    },
    {
      label: "أحداث سجل النشاط",
      value: auditQuery.data?.total ?? 0,
      icon: <ScrollText className="text-purple-600" size={24} />,
      bg: "bg-purple-100 border-purple-200",
      href: "/audit",
      visible: canViewAudit,
    },
  ].filter((s) => s.visible);

  return (
    <div className="flex-1 overflow-auto p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-2xl font-bold text-slate-800">
            مرحباً بك، {user?.fullName} 👋
          </h2>
          <p className="text-slate-500 mt-1 font-medium">
            هذه نظرة عامة على إدارة نظام {user?.storeName}.
          </p>
        </div>

        {stats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex items-center gap-4 group"
                data-testid={`card-stat-${stat.href.slice(1)}`}
              >
                <div
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${stat.bg} group-hover:scale-110 transition-transform`}
                >
                  {stat.icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-500 font-semibold mb-1">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-black text-slate-800">
                    {stat.value}
                  </p>
                </div>
                <ArrowLeft
                  size={18}
                  className="text-slate-300 group-hover:text-amber-500 transition-colors"
                />
              </Link>
            ))}
          </div>
        )}

        {canViewAudit && (
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Activity size={20} className="text-amber-500" />
                أحدث النشاطات
              </h3>
              <Link
                href="/audit"
                className="text-sm text-amber-600 font-bold hover:text-amber-700"
              >
                عرض الكل
              </Link>
            </div>
            {auditQuery.isLoading ? (
              <p className="text-slate-400 text-sm py-6 text-center">
                جارٍ التحميل...
              </p>
            ) : auditQuery.data && auditQuery.data.items.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {auditQuery.data.items.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                        <ScrollText size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {log.action}
                        </p>
                        <p className="text-xs text-slate-400">
                          {log.userName ?? "النظام"}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-sm py-6 text-center">
                لا توجد نشاطات بعد.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
