import React, { useState, useEffect, useRef } from "react"
import { useQuery } from "react-query"
import { MessageCircle, Send, User, LogIn } from "lucide-react"
import ScreenshotQueue from "../components/Queue/ScreenshotQueue"
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastVariant,
  ToastMessage
} from "../components/ui/toast"
import QueueCommands from "../components/Queue/QueueCommands"
import { AuthDialog } from "../components/ui/auth-dialog.tsx"

interface ResponseMode {
  type: 'plain' | 'qna'
  collectionId?: string
  collectionName?: string
}

interface AuthState {
  user: any | null
  session: any | null
  isLoading: boolean
}

interface QueueProps {
  setView: React.Dispatch<React.SetStateAction<"queue" | "solutions" | "debug">>
}

const Queue: React.FC<QueueProps> = ({ setView }) => {
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    title: "",
    description: "",
    variant: "neutral"
  })

  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const [tooltipHeight, setTooltipHeight] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)

  const [chatInput, setChatInput] = useState("")
  const [chatMessages, setChatMessages] = useState<{role: "user"|"gemini", text: string}[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [isChatOpen, setIsChatOpen] = useState(false)
  const chatInputRef = useRef<HTMLInputElement>(null)

  // Auth state
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true
  })
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)
  
  // Response mode state
  const [responseMode, setResponseMode] = useState<ResponseMode>({ type: 'plain' })

  const barRef = useRef<HTMLDivElement>(null)

  const { data: screenshots = [], refetch } = useQuery<Array<{ path: string; preview: string }>, Error>(
    ["screenshots"],
    async () => {
      try {
        const existing = await window.electronAPI.getScreenshots()
        return existing
      } catch (error) {
        console.error("Error loading screenshots:", error)
        showToast("エラー", "既存のスクリーンショットの読み込みに失敗しました", "error")
        return []
      }
    },
    {
      staleTime: Infinity,
      cacheTime: Infinity,
      refetchOnWindowFocus: true,
      refetchOnMount: true
    }
  )

  const showToast = (
    title: string,
    description: string,
    variant: ToastVariant
  ) => {
    setToastMessage({ title, description, variant })
    setToastOpen(true)
  }

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const initialState = await window.electronAPI.invoke('auth-get-state')
        setAuthState(initialState)
      } catch (error) {
        console.error('Error getting initial auth state:', error)
        setAuthState({ user: null, session: null, isLoading: false })
      }
    }
    
    initAuth()
    
    // Poll for auth state changes as a workaround
    const pollAuthState = async () => {
      try {
        const currentState = await window.electronAPI.invoke('auth-get-state')
        setAuthState(currentState)
      } catch (error) {
        console.error('Error polling auth state:', error)
      }
    }
    
    const intervalId = setInterval(pollAuthState, 2000) // Poll every 2 seconds
    
    return () => {
      clearInterval(intervalId)
    }
  }, [])

  const handleDeleteScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index]

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      )

      if (response.success) {
        refetch()
      } else {
        console.error("Failed to delete screenshot:", response.error)
        showToast("エラー", "スクリーンショットファイルの削除に失敗しました", "error")
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error)
    }
  }

  const handleChatSend = async () => {
    if (!chatInput.trim()) return
    setChatMessages((msgs) => [...msgs, { role: "user", text: chatInput }])
    setChatLoading(true)
    const currentInput = chatInput
    setChatInput("")
    
    try {
      let response: string
      
      if (responseMode.type === 'qna' && responseMode.collectionId && authState.user) {
        // Use RAG-enabled chat
        const result = await window.electronAPI.invoke("gemini-chat-rag", currentInput, responseMode.collectionId)
        response = result.response
      } else {
        // Use plain Gemini chat
        response = await window.electronAPI.invoke("gemini-chat", currentInput)
      }
      
      setChatMessages((msgs) => [...msgs, { role: "gemini", text: response }])
    } catch (err) {
      setChatMessages((msgs) => [...msgs, { role: "gemini", text: "エラー: " + String(err) }])
    } finally {
      setChatLoading(false)
      chatInputRef.current?.focus()
    }
  }

  useEffect(() => {
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight
        const contentWidth = contentRef.current.scrollWidth
        if (isTooltipVisible) {
          contentHeight += tooltipHeight
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight
        })
      }
    }

    const resizeObserver = new ResizeObserver(updateDimensions)
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current)
    }
    updateDimensions()

    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onSolutionError((error: string) => {
        showToast(
          "処理失敗",
          "スクリーンショットの処理中にエラーが発生しました。",
          "error"
        )
        setView("queue")
        console.error("Processing error:", error)
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "スクリーンショットなし",
          "処理するスクリーンショットがありません。",
          "neutral"
        )
      })
    ]

    return () => {
      resizeObserver.disconnect()
      cleanupFunctions.forEach((cleanup) => cleanup())
    }
  }, [isTooltipVisible, tooltipHeight])

  // Seamless screenshot-to-LLM flow
  useEffect(() => {
    // Listen for screenshot taken event
    const unsubscribe = window.electronAPI.onScreenshotTaken(async (data) => {
      // Refetch screenshots to update the queue
      await refetch();
      // Show loading in chat
      setChatLoading(true);
      try {
        // Get the latest screenshot path
        const latest = data?.path || (Array.isArray(data) && data.length > 0 && data[data.length - 1]?.path);
        if (latest) {
          // Call the LLM to process the screenshot
          const response = await window.electronAPI.invoke("analyze-image-file", latest);
          setChatMessages((msgs) => [...msgs, { role: "gemini", text: response.text }]);
        }
      } catch (err) {
        setChatMessages((msgs) => [...msgs, { role: "gemini", text: "エラー: " + String(err) }]);
      } finally {
        setChatLoading(false);
      }
    });
    return () => {
      unsubscribe && unsubscribe();
    };
  }, [refetch]);

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible)
    setTooltipHeight(height)
  }

  const handleChatToggle = () => {
    setIsChatOpen(!isChatOpen)
  }

  // Auth handlers
  const handleSignIn = async (email: string, password: string) => {
    try {
      return await window.electronAPI.invoke('auth-sign-in', email, password)
    } catch (error) {
      console.error('Sign in error:', error)
      return { success: false, error: 'Sign in failed' }
    }
  }

  const handleSignUp = async (email: string, password: string) => {
    try {
      return await window.electronAPI.invoke('auth-sign-up', email, password)
    } catch (error) {
      console.error('Sign up error:', error)
      return { success: false, error: 'Sign up failed' }
    }
  }

  const handleSignOut = async () => {
    try {
      const result = await window.electronAPI.invoke('auth-sign-out')
      if (result.success) {
        // Reset response mode to plain when signing out
        setResponseMode({ type: 'plain' })
        showToast('サインアウト', '正常にサインアウトしました', 'neutral')
      }
      return result
    } catch (error) {
      console.error('Sign out error:', error)
      return { success: false, error: 'Sign out failed' }
    }
  }

  const handleResetPassword = async (email: string) => {
    try {
      return await window.electronAPI.invoke('auth-reset-password', email)
    } catch (error) {
      console.error('Reset password error:', error)
      return { success: false, error: 'Password reset failed' }
    }
  }

  const handleResponseModeChange = (mode: ResponseMode) => {
    setResponseMode(mode)
    if (mode.type === 'qna' && mode.collectionName) {
      showToast('モード変更', `${mode.collectionName} コレクションを使用します`, 'neutral')
    } else {
      showToast('モード変更', 'プレーンモードを使用します', 'neutral')
    }
  }


  return (
    <div
      ref={barRef}
      style={{
        position: "relative",
        width: "100%",
        pointerEvents: "auto"
      }}
      className="select-none"
    >
      <div className="bg-transparent w-full">
        <div className="px-2 py-1">
          <Toast
            open={toastOpen}
            onOpenChange={setToastOpen}
            variant={toastMessage.variant}
            duration={3000}
          >
            <ToastTitle>{toastMessage.title}</ToastTitle>
            <ToastDescription>{toastMessage.description}</ToastDescription>
          </Toast>
          <div className="w-fit overflow-visible">
            <QueueCommands
              screenshots={screenshots}
              onTooltipVisibilityChange={handleTooltipVisibilityChange}
              onChatToggle={handleChatToggle}
              responseMode={responseMode}
              onResponseModeChange={handleResponseModeChange}
              isAuthenticated={!!authState.user}
            />
            
            {/* Auth Button */}
            <button
              onClick={() => setIsAuthDialogOpen(true)}
              className="mt-2 w-full bg-white/10 hover:bg-white/20 transition-colors rounded-md px-3 py-2 text-[11px] leading-none text-white/70 flex items-center justify-center gap-2"
              type="button"
            >
              {authState.user ? (
                <>
                  <User className="w-3 h-3" />
                  <span className="truncate max-w-[100px]">{authState.user.email}</span>
                </>
              ) : (
                <>
                  <LogIn className="w-3 h-3" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </div>
          {/* Conditional Chat Interface */}
          {isChatOpen && (
            <div className="mt-4 w-full mx-auto liquid-glass chat-container p-4 flex flex-col">
            <div className="flex-1 overflow-y-auto mb-3 p-3 rounded-lg bg-black/20 backdrop-blur-md max-h-64 min-h-[120px] glass-content border border-white/20">
              {chatMessages.length === 0 ? (
                <div className="text-sm text-white/80 text-center mt-8">
                  <MessageCircle className="w-5 h-5 mx-auto mb-2 text-white/60" />
                  Gemini 2.5 Flashとチャット
                  <br />
                  <span className="text-xs text-white/50">スクリーンショットを撮る (Cmd+H) で自動分析</span>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`w-full flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-3`}
                  >
                    <div
                      className={`max-w-[80%] px-3 py-1.5 rounded-xl text-xs backdrop-blur-sm border ${
                        msg.role === "user" 
                          ? "bg-gray-800/80 text-gray-100 ml-12 border-gray-600/40" 
                          : "bg-black/40 text-white/90 mr-12 border-white/30"
                      }`}
                      style={{ wordBreak: "break-word", lineHeight: "1.4" }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div className="flex justify-start mb-3">
                  <div className="bg-black/40 text-white/80 px-3 py-1.5 rounded-xl text-xs backdrop-blur-sm border border-white/30 mr-12">
                    <span className="inline-flex items-center">
                      <span className="animate-pulse text-white/40">●</span>
                      <span className="animate-pulse animation-delay-200 text-white/40">●</span>
                      <span className="animate-pulse animation-delay-400 text-white/40">●</span>
                      <span className="ml-2">Geminiが考え中...</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
            <form
              className="flex gap-2 items-center glass-content"
              onSubmit={e => {
                e.preventDefault();
                handleChatSend();
              }}
            >
              <input
                ref={chatInputRef}
                className="flex-1 rounded-lg px-3 py-2 bg-black/30 backdrop-blur-md text-white placeholder-white/60 text-xs focus:outline-none focus:ring-1 focus:ring-white/40 border border-white/40 transition-all duration-200"
                placeholder="メッセージを入力..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                disabled={chatLoading}
              />
              <button
                type="submit"
                className="p-2 rounded-lg bg-gray-800/80 hover:bg-gray-900/80 border border-gray-600/60 flex items-center justify-center transition-all duration-200 backdrop-blur-sm disabled:opacity-50"
                disabled={chatLoading || !chatInput.trim()}
                tabIndex={-1}
                aria-label="送信"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-7.5-15-7.5v6l10 1.5-10 1.5v6z" />
                </svg>
              </button>
            </form>
          </div>
          )}
        </div>
      </div>
      
      {/* Auth Dialog */}
      <AuthDialog
        isOpen={isAuthDialogOpen}
        onOpenChange={setIsAuthDialogOpen}
        authState={authState}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onSignOut={handleSignOut}
        onResetPassword={handleResetPassword}
      />
    </div>
  )
}

export default Queue
