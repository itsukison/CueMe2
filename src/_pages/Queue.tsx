import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "react-query";
import { MessageCircle, Send, LogOut, User, Settings } from "lucide-react";
import ScreenshotQueue from "../components/Queue/ScreenshotQueue";
import {
  Toast,
  ToastTitle,
  ToastDescription,
  ToastVariant,
  ToastMessage,
} from "../components/ui/toast";
import QueueCommands from "../components/Queue/QueueCommands";

interface ResponseMode {
  type: "plain" | "qna";
  collectionId?: string;
  collectionName?: string;
}

interface QueueProps {
  setView: React.Dispatch<
    React.SetStateAction<"queue" | "solutions" | "debug">
  >;
  onSignOut: () => Promise<{ success: boolean; error?: string }>;
}

const Queue: React.FC<QueueProps> = ({ setView, onSignOut }) => {
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<ToastMessage>({
    title: "",
    description: "",
    variant: "neutral",
  });

  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const [tooltipHeight, setTooltipHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<
    { role: "user" | "gemini"; text: string }[]
  >([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Profile dropdown state
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);

  // Response mode state
  const [responseMode, setResponseMode] = useState<ResponseMode>({
    type: "plain",
  });

  const barRef = useRef<HTMLDivElement>(null);

  const { data: screenshots = [], refetch } = useQuery<
    Array<{ path: string; preview: string }>,
    Error
  >(
    ["screenshots"],
    async () => {
      try {
        const existing = await window.electronAPI.getScreenshots();
        return existing;
      } catch (error) {
        console.error("Error loading screenshots:", error);
        showToast(
          "エラー",
          "既存のスクリーンショットの読み込みに失敗しました",
          "error"
        );
        return [];
      }
    },
    {
      staleTime: Infinity,
      cacheTime: Infinity,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
    }
  );

  const showToast = (
    title: string,
    description: string,
    variant: ToastVariant
  ) => {
    setToastMessage({ title, description, variant });
    setToastOpen(true);
  };

  const handleDeleteScreenshot = async (index: number) => {
    const screenshotToDelete = screenshots[index];

    try {
      const response = await window.electronAPI.deleteScreenshot(
        screenshotToDelete.path
      );

      if (response.success) {
        refetch();
      } else {
        console.error("Failed to delete screenshot:", response.error);
        showToast(
          "エラー",
          "スクリーンショットファイルの削除に失敗しました",
          "error"
        );
      }
    } catch (error) {
      console.error("Error deleting screenshot:", error);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    setChatMessages((msgs) => [...msgs, { role: "user", text: chatInput }]);
    setChatLoading(true);
    const currentInput = chatInput;
    setChatInput("");

    try {
      let response: string;

      if (responseMode.type === "qna" && responseMode.collectionId) {
        // Use RAG-enabled chat (user is guaranteed to be authenticated at this point)
        const result = await window.electronAPI.invoke(
          "gemini-chat-rag",
          currentInput,
          responseMode.collectionId
        );
        response = result.response;
      } else {
        // Use plain Gemini chat
        response = await window.electronAPI.invoke("gemini-chat", currentInput);
      }

      setChatMessages((msgs) => [...msgs, { role: "gemini", text: response }]);
    } catch (err) {
      setChatMessages((msgs) => [
        ...msgs,
        { role: "gemini", text: "エラー: " + String(err) },
      ]);
    } finally {
      setChatLoading(false);
      chatInputRef.current?.focus();
    }
  };

  useEffect(() => {
    const updateDimensions = () => {
      if (contentRef.current) {
        let contentHeight = contentRef.current.scrollHeight;
        const contentWidth = contentRef.current.scrollWidth;
        if (isTooltipVisible) {
          contentHeight += tooltipHeight;
        }
        window.electronAPI.updateContentDimensions({
          width: contentWidth,
          height: contentHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(updateDimensions);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }
    updateDimensions();

    const cleanupFunctions = [
      window.electronAPI.onScreenshotTaken(() => refetch()),
      window.electronAPI.onResetView(() => refetch()),
      window.electronAPI.onSolutionError((error: string) => {
        showToast(
          "処理失敗",
          "スクリーンショットの処理中にエラーが発生しました。",
          "error"
        );
        setView("queue");
        console.error("Processing error:", error);
      }),
      window.electronAPI.onProcessingNoScreenshots(() => {
        showToast(
          "スクリーンショットなし",
          "処理するスクリーンショットがありません。",
          "neutral"
        );
      }),
    ];

    return () => {
      resizeObserver.disconnect();
      cleanupFunctions.forEach((cleanup) => cleanup());
    };
  }, [isTooltipVisible, tooltipHeight]);

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
        const latest =
          data?.path ||
          (Array.isArray(data) &&
            data.length > 0 &&
            data[data.length - 1]?.path);
        if (latest) {
          // Call the LLM to process the screenshot
          const response = await window.electronAPI.invoke(
            "analyze-image-file",
            latest
          );
          setChatMessages((msgs) => [
            ...msgs,
            { role: "gemini", text: response.text },
          ]);
        }
      } catch (err) {
        setChatMessages((msgs) => [
          ...msgs,
          { role: "gemini", text: "エラー: " + String(err) },
        ]);
      } finally {
        setChatLoading(false);
      }
    });
    return () => {
      unsubscribe && unsubscribe();
    };
  }, [refetch]);

  const handleTooltipVisibilityChange = (visible: boolean, height: number) => {
    setIsTooltipVisible(visible);
    setTooltipHeight(height);
  };

  const handleChatToggle = () => {
    setIsChatOpen(!isChatOpen);
  };

  // Logout handler
  const handleLogout = async () => {
    try {
      const result = await onSignOut();
      if (result.success) {
        // Reset response mode when signing out
        setResponseMode({ type: "plain" });
        // Clear chat messages
        setChatMessages([]);
      }
    } catch (error) {
      console.error("Logout error:", error);
      showToast("エラー", "ログアウトに失敗しました", "error");
    }
    setIsProfileDropdownOpen(false);
  };

  // Settings handler
  const handleSettings = () => {
    window.electronAPI.invoke("open-external-url", "https://www.cueme.ink/");
    setIsProfileDropdownOpen(false);
  };

  const handleResponseModeChange = (mode: ResponseMode) => {
    setResponseMode(mode);
  };

  // Keyboard shortcuts handler
  useEffect(() => {
    // Handle voice recording trigger
    const handleVoiceRecording = () => {
      // Create a custom event to trigger voice recording in QueueCommands
      const event = new CustomEvent("trigger-voice-recording");
      document.dispatchEvent(event);
    };

    const handleChatToggle = () => {
      setIsChatOpen((prev) => !prev);
    };

    // Set up keyboard shortcut listeners using proper electronAPI pattern
    const setupIpcListeners = () => {
      try {
        if (window.electronAPI) {
          const cleanupVoiceRecording =
            window.electronAPI.onVoiceRecordingTrigger(handleVoiceRecording);
          const cleanupChatToggle =
            window.electronAPI.onChatToggle(handleChatToggle);

          return () => {
            cleanupVoiceRecording();
            cleanupChatToggle();
          };
        }
      } catch (error) {
        console.log("IPC setup skipped:", error);
      }
      return () => {};
    };

    const cleanup = setupIpcListeners();
    return cleanup;
  }, []);

  // Click outside handler for profile dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isProfileDropdownOpen &&
        !(event.target as Element)?.closest(".profile-dropdown-container")
      ) {
        setIsProfileDropdownOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

  return (
    <div
      ref={barRef}
      style={{
        position: "relative",
        width: "100%",
        pointerEvents: "auto",
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

          {/* Main Bar with Logout Button */}
          <div className="w-fit overflow-visible relative">
            <div className="flex items-center gap-2">
              <QueueCommands
                screenshots={screenshots}
                onTooltipVisibilityChange={handleTooltipVisibilityChange}
                onChatToggle={handleChatToggle}
                responseMode={responseMode}
                onResponseModeChange={handleResponseModeChange}
                isAuthenticated={true} // User is always authenticated when Queue is rendered
              />
            </div>

            {/* Profile Icon with Dropdown - Fixed position relative to the main bar */}
            <div className="absolute top-0 right-0 transform translate-x-full mt-1 pl-2">
              <div className="relative profile-dropdown-container">
                <button
                  onClick={() =>
                    setIsProfileDropdownOpen(!isProfileDropdownOpen)
                  }
                  className="w-6 h-6 rounded-full flex items-center justify-center transition-all hover:scale-110 bg-black hover:bg-black/80"
                  type="button"
                  title="プロフィール"
                >
                  <User className="w-3 h-3 text-emerald-600" />
                </button>

                {/* Profile Dropdown Menu */}
                {isProfileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-32 morphism-dropdown shadow-lg z-50">
                    <div className="py-1">
                      <button
                        onClick={handleSettings}
                        className="w-full px-3 py-2 text-left text-xs text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-colors rounded-md"
                      >
                        <Settings className="w-3 h-3" />
                        設定
                      </button>
                      <button
                        onClick={handleLogout}
                        className="w-full px-3 py-2 text-left text-xs text-white/80 hover:text-white hover:bg-white/10 flex items-center gap-2 transition-colors rounded-md"
                      >
                        <LogOut className="w-3 h-3" />
                        ログアウト
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Conditional Chat Interface */}
          {isChatOpen && (
            <div className="mt-4 w-full mx-auto liquid-glass chat-container p-4 flex flex-col relative">
              {/* Close Button */}
              <button
                onClick={() => setIsChatOpen(false)}
                className="absolute top-2 right-2 w-6 h-6 rounded-full morphism-button flex items-center justify-center z-10"
                type="button"
                title="閉じる"
              >
                <svg
                  className="w-3 h-3 text-white"
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

              <div className="flex-1 overflow-y-auto mb-3 p-3 rounded-lg morphism-dropdown max-h-64 min-h-[120px] glass-content morphism-scrollbar">
                {chatMessages.length === 0 ? (
                  <div className="text-sm text-white/80 text-center mt-8 pr-8">
                    <MessageCircle className="w-5 h-5 mx-auto mb-2 text-white/60" />
                    CueMeとチャット
                    <br />
                    <span className="text-xs text-white/50">
                      スクリーンショットを撮る (Cmd+H) で自動分析
                    </span>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`w-full flex ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      } mb-3`}
                    >
                      <div
                        className={`max-w-[80%] px-3 py-1.5 rounded-xl text-xs border ${
                          msg.role === "user"
                            ? "bg-gray-800/60 backdrop-blur-md text-gray-100 ml-12 border-gray-600/40"
                            : "morphism-dropdown text-white/90 mr-12"
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
                    <div className="morphism-dropdown text-white/80 px-3 py-1.5 rounded-xl text-xs mr-12">
                      <span className="inline-flex items-center">
                        <span className="animate-pulse text-white/40">●</span>
                        <span className="animate-pulse animation-delay-200 text-white/40">
                          ●
                        </span>
                        <span className="animate-pulse animation-delay-400 text-white/40">
                          ●
                        </span>
                        <span className="ml-2">Geminiが考え中...</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <form
                className="flex gap-2 items-center glass-content"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleChatSend();
                }}
              >
                <input
                  ref={chatInputRef}
                  className="flex-1 morphism-input px-3 py-2 text-white placeholder-white/60 text-xs focus:outline-none transition-all duration-200"
                  placeholder="メッセージを入力..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  className="p-2 morphism-button flex items-center justify-center disabled:opacity-50"
                  disabled={chatLoading || !chatInput.trim()}
                  tabIndex={-1}
                  aria-label="送信"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="white"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 19.5l15-7.5-15-7.5v6l10 1.5-10 1.5v6z"
                    />
                  </svg>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <div ref={contentRef}>
        <ScreenshotQueue
          isLoading={false}
          screenshots={screenshots}
          onDeleteScreenshot={handleDeleteScreenshot}
        />
      </div>
    </div>
  );
};

export default Queue;
