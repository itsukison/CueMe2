import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  LogOut,
  Mic,
  MicOff,
  MessageCircle,
  Command,
  ChevronDown,
  Database,
  Bot,
  Image,
} from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "../ui/dialog";

interface QnACollection {
  id: string;
  name: string;
  description: string | null;
  qna_count?: number;
}

interface ResponseMode {
  type: "plain" | "qna";
  collectionId?: string;
  collectionName?: string;
}

interface QueueCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void;
  screenshots: Array<{ path: string; preview: string }>;
  onChatToggle: () => void;
  responseMode?: ResponseMode;
  onResponseModeChange?: (mode: ResponseMode) => void;
  isAuthenticated?: boolean;
}

const QueueCommands: React.FC<QueueCommandsProps> = ({
  onTooltipVisibilityChange,
  screenshots,
  onChatToggle,
  responseMode = { type: "plain" },
  onResponseModeChange,
  isAuthenticated = false,
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [audioResult, setAudioResult] = useState<string | null>(null);
  const chunks = useRef<Blob[]>([]);

  // Response mode dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [collections, setCollections] = useState<QnACollection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  // Remove all chat-related state, handlers, and the Dialog overlay from this file.

  useEffect(() => {
    let tooltipHeight = 0;
    if (tooltipRef.current && isTooltipVisible) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10;
    }
    onTooltipVisibilityChange(isTooltipVisible, tooltipHeight);
  }, [isTooltipVisible]);

  // Load collections when authenticated
  useEffect(() => {
    if (isAuthenticated && isDropdownOpen && collections.length === 0) {
      loadCollections();
    }
  }, [isAuthenticated, isDropdownOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Update dropdown position when opened
  useEffect(() => {
    if (isDropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4, // 4px gap
        left: rect.left + window.scrollX,
        width: Math.max(192, rect.width), // Min width 192px (w-48)
      });
    }
  }, [isDropdownOpen]);

  // Keyboard shortcut listener for voice recording
  useEffect(() => {
    const handleVoiceRecordingTrigger = () => {
      handleRecordClick();
    };

    document.addEventListener(
      "trigger-voice-recording",
      handleVoiceRecordingTrigger
    );

    return () => {
      document.removeEventListener(
        "trigger-voice-recording",
        handleVoiceRecordingTrigger
      );
    };
  }, [isRecording, mediaRecorder]);

  const loadCollections = async () => {
    if (!isAuthenticated) return;

    try {
      setCollectionsLoading(true);
      console.log(
        "[QueueCommands] Loading collections for authenticated user..."
      );
      const userCollections = await window.electronAPI.invoke(
        "qna-get-collections"
      );
      console.log("[QueueCommands] Loaded collections:", userCollections);
      setCollections(userCollections);
    } catch (error) {
      console.error("Error loading collections:", error);
      setCollections([]);
    } finally {
      setCollectionsLoading(false);
    }
  };

  const handleResponseModeChange = (mode: ResponseMode) => {
    onResponseModeChange?.(mode);
    setIsDropdownOpen(false);
  };

  const toggleDropdown = () => {
    console.log(
      "[QueueCommands] Toggling dropdown. Current state:",
      isDropdownOpen
    );
    console.log("[QueueCommands] Authentication status:", isAuthenticated);
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleMouseEnter = () => {
    setIsTooltipVisible(true);
  };

  const handleMouseLeave = () => {
    setIsTooltipVisible(false);
  };

  const handleRecordClick = async () => {
    if (!isRecording) {
      // Debug current mode before recording
      console.log('[QueueCommands] Starting audio recording with mode:', {
        type: responseMode.type,
        collectionId: responseMode.collectionId,
        collectionName: responseMode.collectionName,
        willUseRAG: responseMode.type === "qna" && !!responseMode.collectionId
      });
      
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => chunks.current.push(e.data);
        recorder.onstop = async () => {
          const blob = new Blob(chunks.current, {
            type: chunks.current[0]?.type || "audio/webm",
          });
          chunks.current = [];
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(",")[1];
            try {
              // Pass collection ID if in QnA mode
              const collectionId =
                responseMode.type === "qna"
                  ? responseMode.collectionId
                  : undefined;
              
              // Debug logging for RAG functionality
              console.log('[QueueCommands] Audio RAG Debug:', {
                responseMode: responseMode,
                responseModeType: responseMode.type,
                responseModeCollectionId: responseMode.collectionId,
                responseModeCollectionName: responseMode.collectionName,
                collectionId: collectionId,
                isQnAMode: responseMode.type === "qna",
                hasCollectionId: !!collectionId,
                willUseRAG: responseMode.type === "qna" && !!collectionId
              });
              
              const result = await window.electronAPI.analyzeAudioFromBase64(
                base64Data,
                blob.type,
                collectionId
              );
              
              // Debug the result
              console.log('[QueueCommands] Audio analysis result:', {
                hasResult: !!result,
                textLength: result?.text?.length || 0,
                hasRagContext: !!(result as any)?.ragContext
              });
              
              setAudioResult(result.text);
            } catch (err: any) {
              // Check if this is a usage limit error
              if (err.message && err.message.includes('Usage limit exceeded') || 
                  err.message && err.message.includes('Monthly limit') ||
                  err.message && err.message.includes('Insufficient usage remaining')) {
                // Show usage limit notification by triggering an event
                const limitEvent = new CustomEvent('usage-limit-exceeded');
                document.dispatchEvent(limitEvent);
                return; // Don't set audio result for usage limit errors
              } else {
                setAudioResult("Audio analysis failed.");
              }
            }
          };
          reader.readAsDataURL(blob);
        };
        setMediaRecorder(recorder);
        recorder.start();
        setIsRecording(true);
      } catch (err) {
        setAudioResult("Could not start recording.");
      }
    } else {
      // Stop recording
      mediaRecorder?.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  // Remove handleChatSend function

  return (
    <div className="w-fit overflow-visible">
      <div className="text-xs text-white/90 liquid-glass-bar py-2 px-4 flex items-center justify-center gap-4 draggable-area overflow-visible">
        {/* Logo */}
         <div className="flex items-center gap-2">
           <img src="/logo.png" alt="CueMe Logo" className="w-4 h-4" />
         </div>

        {/* Separator */}
        {/* <div className="h-4 w-px bg-white/20" /> */}
        
        {/* Response Mode Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] leading-none">モード</span>
          <div className="relative" ref={dropdownRef}>
            <button
              ref={triggerRef}
              className="morphism-button px-2 py-1 text-[11px] leading-none text-white/70 flex items-center gap-1 min-w-[80px]"
              onClick={toggleDropdown}
              type="button"
            >
              {responseMode.type === "plain" ? (
                <>
                  <Bot className="w-3 h-3" />
                  <span>プレーン</span>
                </>
              ) : (
                <>
                  <Database className="w-3 h-3" />
                  <span className="truncate max-w-[60px]">
                    {responseMode.collectionName || "QnA"}
                  </span>
                </>
              )}
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-white/20" />

        {/* Screenshot */}
        {/* Removed screenshot button from main bar for seamless screenshot-to-LLM UX */}

        {/* Solve Command */}
        {screenshots.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] leading-none">Solve</span>
            <div className="flex gap-1">
              <button className="morphism-button px-1.5 py-1 text-[11px] leading-none text-white/70 flex items-center">
                <Command className="w-3 h-3" />
              </button>
              <button className="morphism-button px-1.5 py-1 text-[11px] leading-none text-white/70">
                ↵
              </button>
            </div>
          </div>
        )}

        {/* Voice Recording Button */}
        <div className="flex items-center gap-2">
          <button
            className={`morphism-button px-2 py-1 text-[11px] leading-none text-white/70 flex items-center gap-1 ${
              isRecording ? "!bg-red-500/70 hover:!bg-red-500/90" : ""
            }`}
            onClick={handleRecordClick}
            type="button"
          >
            {isRecording ? (
              <>
                <MicOff className="w-4 h-4 mr-1" />
                <span className="animate-pulse">録音停止</span>
              </>
            ) : (
              <>
                <Mic className="w-3 h-3 mr-1" />
                <span>音声録音</span>
              </>
            )}
          </button>
        </div>

        {/* Chat Button */}
        <div className="flex items-center gap-2">
          <button
            className="morphism-button px-2 py-1 text-[11px] leading-none text-white/70 flex items-center gap-1"
            onClick={onChatToggle}
            type="button"
          >
            <MessageCircle className="w-3 h-3 mr-1" />
            チャット
          </button>
        </div>

        {/* Add this button in the main button row, before the separator and sign out */}
        {/* Remove the Chat button */}

        {/* Separator */}
        <div className="mx-2 h-4 w-px bg-white/20" />

        {/* Sign Out Button - Moved to end */}
        <button
          className="text-red-500/70 hover:text-red-500/90 transition-colors hover:cursor-pointer"
          title="サインアウト"
          onClick={() => window.electronAPI.quitApp()}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
      
      {/* Audio Result Display - positioned below the floating bar */}
      {audioResult && (
        <div className="mt-2 liquid-glass chat-container p-4 text-white/90 text-xs relative" style={{ minWidth: '400px', maxWidth: '600px' }}>
          {/* AI Response Label with Logo */}
          <div className="mb-2 text-sm font-medium text-white/80 flex items-center gap-2">
            <img src="/logo.png" alt="CueMe Logo" className="w-4 h-4" />
            <span>AI回答</span>
          </div>

          {/* Close Button */}
          <button
            onClick={() => setAudioResult(null)}
            className="absolute top-2 right-2 w-5 h-5 rounded-full morphism-button flex items-center justify-center"
            type="button"
            title="閉じる"
          >
            <svg
              className="w-2.5 h-2.5 text-white"
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

          <div className="pr-8">{audioResult}</div>
        </div>
      )}
      {/* Chat Dialog Overlay */}
      {/* Remove the Dialog component */}

      {/* Dropdown Portal - Rendered outside component tree to escape container constraints */}
      {isDropdownOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed morphism-dropdown shadow-xl z-[9999] max-h-64 overflow-y-auto"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
            }}
          >
            <div className="p-1">
              {/* Plain Mode Option */}
              <button
                className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] rounded-md transition-colors ${
                  responseMode.type === "plain"
                    ? "bg-white/20 text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
                onClick={() => handleResponseModeChange({ type: "plain" })}
              >
                <Bot className="w-4 h-4" />
                <div className="text-left">
                  <div className="font-medium">プレーン回答</div>
                  <div className="text-[10px] text-white/50">
                    Geminiの直接回答
                  </div>
                </div>
              </button>

              {/* Separator */}
              {isAuthenticated && <div className="h-px bg-white/10 my-1" />}

              {/* QnA Collections */}
              {isAuthenticated ? (
                collectionsLoading ? (
                  <div className="px-3 py-2 text-[11px] text-white/50">
                    Loading collections...
                  </div>
                ) : collections.length > 0 ? (
                  collections.map((collection) => (
                    <button
                      key={collection.id}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] rounded-md transition-colors ${
                        responseMode.type === "qna" &&
                        responseMode.collectionId === collection.id
                          ? "bg-white/20 text-white"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                      onClick={() =>
                        handleResponseModeChange({
                          type: "qna",
                          collectionId: collection.id,
                          collectionName: collection.name,
                        })
                      }
                    >
                      <Database className="w-4 h-4" />
                      <div className="text-left flex-1">
                        <div className="font-medium truncate">
                          {collection.name}
                        </div>
                        <div className="text-[10px] text-white/50">
                          {collection.qna_count || 0} items
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-[11px] text-white/50">
                    No QnA collections found
                  </div>
                )
              ) : (
                <div className="px-3 py-2 text-[11px] text-white/50">
                  Sign in to use QnA collections
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default QueueCommands;
