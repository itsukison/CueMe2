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
  Move,
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

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragRef = useRef<HTMLDivElement>(null);
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
      setPosition({ x: 0, y: 0 }); // Reset position when dialog closes
    }
  }, [isOpen]);

  // Dragging handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!dialogRef.current) return;
    
    const rect = dialogRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      // Calculate position relative to viewport
      const newX = e.clientX - dragOffset.x - window.innerWidth / 2;
      const newY = e.clientY - dragOffset.y - window.innerHeight / 2;
      
      // Constrain to viewport boundaries
      const maxX = window.innerWidth / 2 - 200; // Account for dialog width
      const maxY = window.innerHeight / 2 - 150; // Account for dialog height
      const minX = -window.innerWidth / 2 + 200;
      const minY = -window.innerHeight / 2 + 150;
      
      const constrainedX = Math.max(minX, Math.min(maxX, newX));
      const constrainedY = Math.max(minY, Math.min(maxY, newY));
      
      setPosition({ x: constrainedX, y: constrainedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

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
    // User is authenticated - show simple confirmation dialog
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent 
          ref={dialogRef}
          className="w-96 max-w-md bg-black/80 backdrop-blur-md border border-white/20 rounded-lg p-0 overflow-hidden draggable-dialog"
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
            zIndex: 9999,
          }}
        >
          {/* Draggable Header */}
          <div
            ref={dragRef}
            className="flex items-center justify-between p-4 border-b border-white/10 cursor-move select-none bg-white/5"
            onMouseDown={handleMouseDown}
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-medium text-white">ユーザーアカウント</h3>
            </div>
            <Move className="w-4 h-4 text-white/40" />
          </div>

          <div className="p-4 space-y-3">
            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                <p className="text-xs text-red-200 text-center">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3 text-white/80">
              <User className="w-4 h-4 text-emerald-600" />
              <span className="text-sm truncate">{authState.user.email}</span>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full px-4 py-3 text-sm bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium border border-red-500/30 flex items-center justify-center gap-2"
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
        className="w-96 max-w-md bg-black/80 backdrop-blur-md border border-white/20 rounded-lg p-0 overflow-hidden draggable-dialog"
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
          zIndex: 9999,
        }}
      >
        {/* Draggable Header */}
        <div
          ref={dragRef}
          className="flex items-center justify-between p-4 border-b border-white/10 cursor-move select-none bg-white/5"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <LogIn className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-medium text-white">
              {mode === "signin" ? "ログイン" : mode === "signup" ? "アカウント作成" : "パスワードリセット"}
            </h3>
          </div>
          <Move className="w-4 h-4 text-white/40" />
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-xs text-red-200 text-center">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
              <p className="text-xs text-green-200 text-center">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-3 py-3 text-sm bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-white/40 text-white placeholder-white/60"
                placeholder="メールアドレス"
                required
              />
            </div>

            {mode !== "reset" && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 text-sm bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-white/40 text-white placeholder-white/60"
                  placeholder="パスワード"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/60"
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
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-3 py-3 text-sm bg-white/10 border border-white/20 rounded-lg focus:outline-none focus:border-white/40 text-white placeholder-white/60"
                  placeholder="パスワード再入力"
                  required
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 text-sm bg-emerald-700/80 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium border border-emerald-600/30"
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

          <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
            {mode === "signin" && (
              <>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="text-xs text-white/60 hover:text-white/80 transition-colors"
                >
                  アカウントを作成する
                </button>
                <button
                  type="button"
                  onClick={() => setMode("reset")}
                  className="text-xs text-white/60 hover:text-white/80 transition-colors"
                >
                  パスワードを忘れた方
                </button>
              </>
            )}
            {mode !== "signin" && (
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-xs text-white/60 hover:text-white/80 transition-colors"
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
