import React, { useState, useEffect, useRef } from "react";
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

  const dialogRef = useRef<HTMLDivElement>(null);

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

  const handleSignUpRedirect = () => {
    // Open signup page
    window.electronAPI.invoke(
      "open-external-url",
      "https://www.cueme.ink/signup"
    );
    // Hide window (equivalent to Command+B)
    window.electronAPI.invoke("toggle-window");
  };

  if (authState.user) {
    // User is authenticated - show simple confirmation dialog
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent
          ref={dialogRef}
          className="w-96 max-w-md border-0 rounded-2xl p-0 overflow-hidden shadow-2xl"
          style={{ backgroundColor: "#F7F7EE" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-300">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5" style={{ color: "#013220" }} />
              <h3 className="text-xl font-bold" style={{ color: "#013220" }}>
                ユーザーアカウント
              </h3>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 text-center">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3 text-black">
              <User className="w-5 h-5" style={{ color: "#013220" }} />
              <span className="text-sm truncate">{authState.user.email}</span>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full px-4 py-3 text-sm bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed text-red-700 rounded-lg transition-colors font-medium border border-red-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  ログアウト
                </>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // User is not authenticated - show login dialog
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogRef}
        className="w-96 max-w-md border-0 rounded-2xl p-0 overflow-hidden shadow-2xl"
        style={{ backgroundColor: "#F7F7EE" }}
      >
        {/* Header */}
        <div className="flex items-center justify-center p-6 border-b border-gray-300">
          <div className="flex items-center gap-3">
            <LogIn className="w-5 h-5" style={{ color: "#013220" }} />
            <h3 className="text-xl font-bold" style={{ color: "#013220" }}>
              {mode === "signin"
                ? "ログイン"
                : mode === "signup"
                ? "アカウント作成"
                : "パスワードリセット"}
            </h3>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700 text-center">{error}</p>
            </div>
          )}

          {success && (
            <div
              className="p-3 border rounded-lg"
              style={{ backgroundColor: "#f0f9f0", borderColor: "#013220" }}
            >
              <p className="text-sm text-center" style={{ color: "#013220" }}>
                {success}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 text-black placeholder-gray-500"
                placeholder="メールアドレス"
                required
              />
            </div>

            {mode !== "reset" && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 text-black placeholder-gray-500"
                  placeholder="パスワード"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}

            {mode === "signup" && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-800 text-black placeholder-gray-500"
                  placeholder="パスワード再入力"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium border-0 hover:opacity-90"
              style={{ backgroundColor: "#013220" }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : mode === "signin" ? (
                "ログイン"
              ) : mode === "signup" ? (
                "アカウント作成"
              ) : (
                "リセットメール送信"
              )}
            </button>
          </form>

          <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
            {mode === "signin" && (
              <>
                <button
                  type="button"
                  onClick={handleSignUpRedirect}
                  className="text-sm text-gray-600 hover:text-black transition-colors"
                >
                  アカウントを作成する
                </button>
                <button
                  type="button"
                  onClick={() => setMode("reset")}
                  className="text-sm text-gray-600 hover:text-black transition-colors"
                >
                  パスワードを忘れた方
                </button>
              </>
            )}
            {mode !== "signin" && (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-sm text-gray-600 hover:text-black transition-colors"
              >
                ログインに戻る
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
