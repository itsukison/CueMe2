import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "./dialog";
import {
  User,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  LogIn,
} from "lucide-react";

interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
}

interface AuthDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  authState: AuthState;
  onSignIn: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  onSignUp: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  onSignOut: () => Promise<{ success: boolean; error?: string }>;
  onResetPassword: (
    email: string
  ) => Promise<{ success: boolean; error?: string }>;
}

export const AuthDialog: React.FC<AuthDialogProps> = ({
  isOpen,
  onOpenChange,
  authState,
  onSignIn,
  onSignUp,
  onSignOut,
  onResetPassword,
}) => {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setError("");
      setSuccess("");
      setMode("signin");
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "signup") {
        if (password !== confirmPassword) {
          setError("パスワードが一致しません");
          return;
        }
        if (password.length < 6) {
          setError("パスワードは6文字以上である必要があります");
          return;
        }

        const result = await onSignUp(email, password);
        if (result.success) {
          setSuccess(
            "アカウントが作成されました！確認メールをご確認ください。"
          );
          setMode("signin");
        } else {
          setError(result.error || "アカウント作成に失敗しました");
        }
      } else if (mode === "signin") {
        const result = await onSignIn(email, password);
        if (result.success) {
          onOpenChange(false);
        } else {
          setError(result.error || "ログインに失敗しました");
        }
      } else if (mode === "reset") {
        const result = await onResetPassword(email);
        if (result.success) {
          setSuccess("パスワードリセットメールを送信しました！");
          setMode("signin");
        } else {
          setError(result.error || "リセットメールの送信に失敗しました");
        }
      }
    } catch (err) {
      setError("予期しないエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      const result = await onSignOut();
      if (result.success) {
        onOpenChange(false);
      } else {
        setError(result.error || "ログアウトに失敗しました");
      }
    } catch (err) {
      setError("予期しないエラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  if (authState.user) {
    // User is authenticated - show inline logout form with same styling
    return (
      <div className="w-full liquid-glass chat-container p-4 relative">
        {/* Close Button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-all"
          type="button"
          title="閉じる"
        >
          <svg
            className="w-2.5 h-2.5 text-white/70"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {error && (
          <div className="mb-2 p-2 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-xs text-red-200 text-center">{error}</p>
          </div>
        )}

        <div className="flex gap-2 items-center pr-8">
          <div className="flex-1 flex items-center gap-2 text-white/70 text-xs">
            <User className="w-3 h-3" />
            <span className="truncate">{authState.user.email}</span>
          </div>

          <button
            onClick={handleSignOut}
            disabled={loading}
            className="px-4 py-2 text-xs bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium border border-white/20 flex items-center gap-1"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <LogOut className="w-3 h-3" />
                ログアウト
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // User is not authenticated - show inline form below the bar (no dialog wrapper)
  return (
    <div className="w-full liquid-glass chat-container p-4 relative">
      {/* Close Button */}
      <button
        onClick={() => onOpenChange(false)}
        className="absolute top-2 right-2 w-5 h-5 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-all"
        type="button"
        title="閉じる"
      >
        <svg
          className="w-2.5 h-2.5 text-white/70"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {error && (
        <div className="mb-2 p-2 bg-red-500/20 border border-red-500/30 rounded-lg">
          <p className="text-xs text-red-200 text-center">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2 pr-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-white/40" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-7 pr-2 py-2 text-xs bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-white/40 text-white placeholder-white/60"
              placeholder="メールアドレス"
              required
            />
          </div>

          <div className="relative flex-1">
            <Lock className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-white/40" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-7 pr-8 py-2 text-xs bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-white/40 text-white placeholder-white/60"
              placeholder="パスワード"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/60"
            >
              {showPassword ? (
                <EyeOff className="w-3 h-3" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-xs bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium border border-white/20"
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              "ログイン"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
