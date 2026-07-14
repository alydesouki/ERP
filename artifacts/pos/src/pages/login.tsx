import { useState, useEffect, useRef, type FormEvent } from "react";
import { Package, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ApiError, searchUsers } from "@workspace/api-client-react";

type UserSearchResult = Awaited<ReturnType<typeof searchUsers>>[0];

export function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Autocomplete state
  const [users, setUsers] = useState<UserSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!username.trim() || !isOpen) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoadingUsers(true);
      try {
        const results = await searchUsers({ q: username.trim() });
        setUsers(results);
        setSelectedIndex(-1);
      } catch (err) {
        console.error("Failed to search users", err);
      } finally {
        setIsLoadingUsers(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [username, isOpen]);

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("الرجاء إدخال اسم المستخدم وكلمة المرور.");
      return;
    }
    if (password.length < 4) {
      setError("Password must contain at least 4 characters.");
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

  function handleUsernameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen && username.trim()) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") setIsOpen(true);
    }
    
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < users.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && selectedIndex >= 0 && selectedIndex < users.length) {
        setUsername(users[selectedIndex].username);
        setIsOpen(false);
        passwordInputRef.current?.focus();
      } else {
        setIsOpen(false);
        passwordInputRef.current?.focus();
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  function selectUser(user: UserSearchResult) {
    setUsername(user.username);
    setIsOpen(false);
    passwordInputRef.current?.focus();
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
          <div className="relative" ref={dropdownRef}>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              اسم المستخدم
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => {
                if (username.trim()) setIsOpen(true);
              }}
              onKeyDown={handleUsernameKeyDown}
              autoComplete="off"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition"
              placeholder="أدخل اسم المستخدم"
              data-testid="input-username"
            />
            {isOpen && username.trim() && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto overflow-x-hidden">
                {isLoadingUsers ? (
                  <div className="p-4 flex justify-center text-slate-400">
                    <Loader2 size={18} className="animate-spin" />
                  </div>
                ) : users.length > 0 ? (
                  <ul className="py-2">
                    {users.map((user, index) => (
                      <li
                        key={user.id}
                        onMouseDown={(e) => e.preventDefault()} // Prevent blur from firing before click
                        onClick={() => selectUser(user)}
                        className={`px-4 py-2 cursor-pointer flex flex-col ${
                          index === selectedIndex ? "bg-amber-50" : "hover:bg-slate-50"
                        }`}
                      >
                        <span className="font-semibold text-slate-800">{user.username}</span>
                        {user.fullName && (
                          <span className="text-xs text-slate-500">{user.fullName}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-4 text-sm text-slate-500 text-center">
                    No users found
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                ref={passwordInputRef}
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
