import React, { useState, useEffect, useRef } from "react"
import { LogOut, Mic, MicOff, MessageCircle, Command, ChevronDown, Database, Bot } from "lucide-react"
import { Dialog, DialogContent, DialogClose } from "../ui/dialog"

interface QnACollection {
  id: string
  name: string
  description: string | null
  qna_count?: number
}

interface ResponseMode {
  type: 'plain' | 'qna'
  collectionId?: string
  collectionName?: string
}

interface QueueCommandsProps {
  onTooltipVisibilityChange: (visible: boolean, height: number) => void
  screenshots: Array<{ path: string; preview: string }>
  onChatToggle: () => void
  responseMode?: ResponseMode
  onResponseModeChange?: (mode: ResponseMode) => void
  isAuthenticated?: boolean
}

const QueueCommands: React.FC<QueueCommandsProps> = ({
  onTooltipVisibilityChange,
  screenshots,
  onChatToggle,
  responseMode = { type: 'plain' },
  onResponseModeChange,
  isAuthenticated = false
}) => {
  const [isTooltipVisible, setIsTooltipVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioResult, setAudioResult] = useState<string | null>(null)
  const chunks = useRef<Blob[]>([])
  
  // Response mode dropdown state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [collections, setCollections] = useState<QnACollection[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // Remove all chat-related state, handlers, and the Dialog overlay from this file.

  useEffect(() => {
    let tooltipHeight = 0
    if (tooltipRef.current && isTooltipVisible) {
      tooltipHeight = tooltipRef.current.offsetHeight + 10
    }
    onTooltipVisibilityChange(isTooltipVisible, tooltipHeight)
  }, [isTooltipVisible])

  // Load collections when authenticated
  useEffect(() => {
    if (isAuthenticated && isDropdownOpen && collections.length === 0) {
      loadCollections()
    }
  }, [isAuthenticated, isDropdownOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isDropdownOpen])

  const loadCollections = async () => {
    if (!isAuthenticated) return
    
    try {
      setCollectionsLoading(true)
      const userCollections = await window.electronAPI.invoke('qna-get-collections')
      setCollections(userCollections)
    } catch (error) {
      console.error('Error loading collections:', error)
      setCollections([])
    } finally {
      setCollectionsLoading(false)
    }
  }

  const handleResponseModeChange = (mode: ResponseMode) => {
    onResponseModeChange?.(mode)
    setIsDropdownOpen(false)
  }

  const handleMouseEnter = () => {
    setIsTooltipVisible(true)
  }

  const handleMouseLeave = () => {
    setIsTooltipVisible(false)
  }

  const handleRecordClick = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const recorder = new MediaRecorder(stream)
        recorder.ondataavailable = (e) => chunks.current.push(e.data)
        recorder.onstop = async () => {
          const blob = new Blob(chunks.current, { type: chunks.current[0]?.type || 'audio/webm' })
          chunks.current = []
          const reader = new FileReader()
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1]
            try {
              const result = await window.electronAPI.analyzeAudioFromBase64(base64Data, blob.type)
              setAudioResult(result.text)
            } catch (err) {
              setAudioResult('Audio analysis failed.')
            }
          }
          reader.readAsDataURL(blob)
        }
        setMediaRecorder(recorder)
        recorder.start()
        setIsRecording(true)
      } catch (err) {
        setAudioResult('Could not start recording.')
      }
    } else {
      // Stop recording
      mediaRecorder?.stop()
      setIsRecording(false)
      setMediaRecorder(null)
    }
  }

  // Remove handleChatSend function

  return (
    <div className="w-fit">
      <div className="text-xs text-white/90 liquid-glass-bar py-1 px-4 flex items-center justify-center gap-4 draggable-area">
        {/* Response Mode Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] leading-none">Mode</span>
          <div className="relative" ref={dropdownRef}>
            <button
              className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-2 py-1 text-[11px] leading-none text-white/70 flex items-center gap-1 min-w-[80px]"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              type="button"
            >
              {responseMode.type === 'plain' ? (
                <><Bot className="w-3 h-3" /><span>Plain</span></>
              ) : (
                <><Database className="w-3 h-3" /><span className="truncate max-w-[60px]">{responseMode.collectionName || 'QnA'}</span></>
              )}
              <ChevronDown className={`w-3 h-3 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-black/90 backdrop-blur-md rounded-lg border border-white/20 shadow-lg z-50">
                <div className="p-1">
                  {/* Plain Mode Option */}
                  <button
                    className={`w-full flex items-center gap-2 px-3 py-2 text-[11px] rounded-md transition-colors ${
                      responseMode.type === 'plain' 
                        ? 'bg-white/20 text-white' 
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`}
                    onClick={() => handleResponseModeChange({ type: 'plain' })}
                  >
                    <Bot className="w-3 h-3" />
                    <div className="text-left">
                      <div className="font-medium">Plain Responses</div>
                      <div className="text-[10px] text-white/50">Direct Gemini answers</div>
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
                            responseMode.type === 'qna' && responseMode.collectionId === collection.id
                              ? 'bg-white/20 text-white' 
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                          onClick={() => handleResponseModeChange({ 
                            type: 'qna', 
                            collectionId: collection.id, 
                            collectionName: collection.name 
                          })}
                        >
                          <Database className="w-3 h-3" />
                          <div className="text-left flex-1">
                            <div className="font-medium truncate">{collection.name}</div>
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
              </div>
            )}
          </div>
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-white/20" />
        {/* Show/Hide */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] leading-none">表示/非表示</span>
          <div className="flex gap-1">
            <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70 flex items-center">
              <Command className="w-3 h-3" />
            </button>
            <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
              B
            </button>
          </div>
        </div>

        {/* Screenshot */}
        {/* Removed screenshot button from main bar for seamless screenshot-to-LLM UX */}

        {/* Solve Command */}
        {screenshots.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] leading-none">Solve</span>
            <div className="flex gap-1">
              <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70 flex items-center">
                <Command className="w-3 h-3" />
              </button>
              <button className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-1.5 py-1 text-[11px] leading-none text-white/70">
                ↵
              </button>
            </div>
          </div>
        )}

        {/* Voice Recording Button */}
        <div className="flex items-center gap-2">
          <button
            className={`bg-white/10 hover:bg-white/20 transition-colors rounded-md px-2 py-1 text-[11px] leading-none text-white/70 flex items-center gap-1 ${isRecording ? 'bg-red-500/70 hover:bg-red-500/90' : ''}`}
            onClick={handleRecordClick}
            type="button"
          >
            {isRecording ? (
              <><MicOff className="w-3 h-3 mr-1" /><span className="animate-pulse">録音停止</span></>
            ) : (
              <><Mic className="w-3 h-3 mr-1" /><span>音声録音</span></>
            )}
          </button>
        </div>

        {/* Chat Button */}
        <div className="flex items-center gap-2">
          <button
            className="bg-white/10 hover:bg-white/20 transition-colors rounded-md px-2 py-1 text-[11px] leading-none text-white/70 flex items-center gap-1"
            onClick={onChatToggle}
            type="button"
          >
            <MessageCircle className="w-3 h-3 mr-1" />チャット
          </button>
        </div>

        {/* Add this button in the main button row, before the separator and sign out */}
        {/* Remove the Chat button */}

        {/* Question mark with tooltip */}
        <div
          className="relative inline-block"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm transition-colors flex items-center justify-center cursor-help z-10">
            <span className="text-xs text-white/70">?</span>
          </div>

          {/* Tooltip Content */}
          {isTooltipVisible && (
            <div
              ref={tooltipRef}
              className="absolute top-full right-0 mt-2 w-80"
            >
              <div className="p-3 text-xs bg-black/80 backdrop-blur-md rounded-lg border border-white/10 text-white/90">
                <div className="space-y-4">
                  <h3 className="font-medium truncate">キーボードショートカット</h3>
                  <div className="space-y-3">
                    {/* Toggle Command */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate">ウィンドウ切り替え</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none flex items-center">
                            <Command className="w-2 h-2" />
                          </span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            B
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/70 truncate">
                        このウィンドウを表示または非表示にします。
                      </p>
                    </div>
                    {/* Screenshot Command */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate">スクリーンショットを撮る</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none flex items-center">
                            <Command className="w-2 h-2" />
                          </span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            H
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/70 truncate">
                        問題の説明のスクリーンショットを撮ります。ツールは問題を抽出して分析します。最新のスクリーンショット5枚が保存されます。
                      </p>
                    </div>

                    {/* Solve Command */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate">問題を解決</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none flex items-center">
                            <Command className="w-2 h-2" />
                          </span>
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-[10px] leading-none">
                            ↵
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] leading-relaxed text-white/70 truncate">
                        現在の問題に基づいた解決策を生成します。
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

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
      {/* Audio Result Display */}
      {audioResult && (
        <div className="mt-2 p-2 bg-white/10 rounded text-white text-xs max-w-md">
          <span className="font-semibold">音声結果:</span> {audioResult}
        </div>
      )}
      {/* Chat Dialog Overlay */}
      {/* Remove the Dialog component */}
    </div>
  )
}

export default QueueCommands
