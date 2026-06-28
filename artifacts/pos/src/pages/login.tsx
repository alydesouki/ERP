import { useState, type FormEvent } from "react";
import { Package, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@workspace/api-client-react";

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("الرجاء إدخال اسم المستخدم وكلمة المرور.");
      return;
    }
    setSubmitting(true);
    try {
      await login({ username: username.trim(), password });
    } catch (err) {
      if (err instanceof ApiError) {
        const data = err.data as { error?: string } | undefined;
        setError(data?.error ?? "تعذّر تسجيل الدخول. حاول مرة أخرى.");
      } else {
        setError("حدث خطأ غير متوقع. حاول مرة أخرى.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <Package size={32} className="text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold text-white">نظام نقاط البيع</h1>
          <p className="text-slate-400 mt-1">سجّل الدخول للمتابعة</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-8 space-y-5"
        >
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              اسم المستخدم
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition"
              placeholder="أدخل اسم المستخدم"
              data-testid="input-username"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition"
                placeholder="أدخل كلمة المرور"
                data-testid="input-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="bg-red-50 text-red-700 text-sm font-medium rounded-xl px-4 py-3 border border-red-100"
              data-testid="text-login-error"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            data-testid="button-login"
          >
            {submitting && <Loader2 size={18} className="animate-spin" />}
            {submitting ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
