import { ToastProvider } from "./components/ui/toast";
import Queue from "./_pages/Queue";
import { ToastViewport } from "@radix-ui/react-toast";
import { useEffect, useRef, useState } from "react";
import Solutions from "./_pages/Solutions";
import { QueryClient, QueryClientProvider } from "react-query";
import { AuthDialog } from "./components/ui/auth-dialog";

declare global {
  interface Window {
    electronAPI: {
      //RANDOM GETTER/SETTERS
      updateContentDimensions: (dimensions: {
        width: number;
        height: number;
      }) => Promise<void>;
      getScreenshots: () => Promise<Array<{ path: string; preview: string }>>;

      //GLOBAL EVENTS
      //TODO: CHECK THAT PROCESSING NO SCREENSHOTS AND TAKE SCREENSHOTS ARE BOTH CONDITIONAL
      onUnauthorized: (callback: () => void) => () => void;
      onScreenshotTaken: (
        callback: (data: { path: string; preview: string }) => void
      ) => () => void;
      onProcessingNoScreenshots: (callback: () => void) => () => void;
      onResetView: (callback: () => void) => () => void;
      takeScreenshot: () => Promise<void>;

      //INITIAL SOLUTION EVENTS
      deleteScreenshot: (
        path: string
      ) => Promise<{ success: boolean; error?: string }>;
      onSolutionStart: (callback: () => void) => () => void;
      onSolutionError: (callback: (error: string) => void) => () => void;
      onSolutionSuccess: (callback: (data: any) => void) => () => void;
      onProblemExtracted: (callback: (data: any) => void) => () => void;

      onDebugSuccess: (callback: (data: any) => void) => () => void;

      onDebugStart: (callback: () => void) => () => void;
      onDebugError: (callback: (error: string) => void) => () => void;

      // Audio Processing
      analyzeAudioFromBase64: (
        data: string,
        mimeType: string,
        collectionId?: string
      ) => Promise<{ text: string; timestamp: number }>;
      analyzeAudioFile: (
        path: string,
        collectionId?: string
      ) => Promise<{ text: string; timestamp: number }>;

      moveWindowLeft: () => Promise<void>;
      moveWindowRight: () => Promise<void>;
      moveWindowUp: () => Promise<void>;
      moveWindowDown: () => Promise<void>;
      quitApp: () => Promise<void>;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      onVoiceRecordingTrigger: (callback: () => void) => () => void;
      onChatToggle: (callback: () => void) => () => void;
    };
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      cacheTime: Infinity,
    },
  },
});

interface AuthState {
  user: any | null;
  session: any | null;
  isLoading: boolean;
}

const App: React.FC = () => {
  const [view, setView] = useState<"queue" | "solutions" | "debug">("queue");
  const containerRef = useRef<HTMLDivElement>(null);

  // Authentication state
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
  });

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const initialState = await window.electronAPI.invoke("auth-get-state");
        setAuthState(initialState);
      } catch (error) {
        console.error("Error getting initial auth state:", error);
        setAuthState({ user: null, session: null, isLoading: false });
      }
    };

    initAuth();

    // Poll for auth state changes
    const pollAuthState = async () => {
      try {
        const currentState = await window.electronAPI.invoke("auth-get-state");
        setAuthState((prevState) => {
          // If user was previously unauthenticated and now is authenticated, show window
          if (!prevState.user && currentState.user && !currentState.isLoading) {
            console.log("User signed in successfully, showing window");
            window.electronAPI.invoke("center-and-show-window");
          }
          return currentState;
        });
      } catch (error) {
        console.error("Error polling auth state:", error);
      }
    };

    const intervalId = setInterval(pollAuthState, 2000); // Poll every 2 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Effect for height monitoring
  useEffect(() => {
    const cleanup = window.electronAPI.onResetView(() => {
      console.log("Received 'reset-view' message from main process.");
      queryClient.invalidateQueries(["screenshots"]);
      queryClient.invalidateQueries(["problem_statement"]);
      queryClient.invalidateQueries(["solution"]);
      queryClient.invalidateQueries(["new_solution"]);
      setView("queue");
    });

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateHeight = () => {
      if (!containerRef.current) return;
      const height = containerRef.current.scrollHeight;
      const width = containerRef.current.scrollWidth;
      window.electronAPI?.updateContentDimensions({ width, height });
    };

    const resizeObserver = new ResizeObserver(() => {
      updateHeight();
    });

    // Initial height update
    updateHeight();

    // Observe for changes
    resizeObserver.observe(containerRef.current);

    // Also update height when view changes
    const mutationObserver = new MutationObserver(() => {
      updateHeight();
    });

    mutationObserver.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [view]); // Re-run when view changes

  // Auth handlers
  const handleSignIn = async (email: string, password: string) => {
    try {
      return await window.electronAPI.invoke("auth-sign-in", email, password);
    } catch (error) {
      console.error("Sign in error:", error);
      return { success: false, error: "Sign in failed" };
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    try {
      return await window.electronAPI.invoke("auth-sign-up", email, password);
    } catch (error) {
      console.error("Sign up error:", error);
      return { success: false, error: "Sign up failed" };
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      return await window.electronAPI.invoke("auth-reset-password", email);
    } catch (error) {
      console.error("Reset password error:", error);
      return { success: false, error: "Password reset failed" };
    }
  };

  const handleSignOut = async () => {
    try {
      const result = await window.electronAPI.invoke("auth-sign-out");
      if (result.success) {
        // Clear all queries when signing out
        queryClient.clear();
        setView("queue");
      }
      return result;
    } catch (error) {
      console.error("Sign out error:", error);
      return { success: false, error: "Sign out failed" };
    }
  };

  useEffect(() => {
    const cleanupFunctions = [
      window.electronAPI.onSolutionStart(() => {
        setView("solutions");
        console.log("starting processing");
      }),

      window.electronAPI.onUnauthorized(() => {
        queryClient.removeQueries(["screenshots"]);
        queryClient.removeQueries(["solution"]);
        queryClient.removeQueries(["problem_statement"]);
        setView("queue");
        console.log("Unauthorized");
      }),
      // Update this reset handler
      window.electronAPI.onResetView(() => {
        console.log("Received 'reset-view' message from main process");

        queryClient.removeQueries(["screenshots"]);
        queryClient.removeQueries(["solution"]);
        queryClient.removeQueries(["problem_statement"]);
        setView("queue");
        console.log("View reset to 'queue' via Command+R shortcut");
      }),
      window.electronAPI.onProblemExtracted((data: any) => {
        if (view === "queue") {
          console.log("Problem extracted successfully");
          queryClient.invalidateQueries(["problem_statement"]);
          queryClient.setQueryData(["problem_statement"], data);
        }
      }),
    ];
    return () => cleanupFunctions.forEach((cleanup) => cleanup());
  }, []);

  // If user is not authenticated, show auth dialog
  if (!authState.user && !authState.isLoading) {
    return (
      <div
        ref={containerRef}
        className="w-full flex items-center justify-center"
        style={{ width: "500px", height: "600px" }}
      >
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthDialog
              isOpen={true}
              onOpenChange={() => {}} // Prevent closing until authenticated
              authState={authState}
              onSignIn={handleSignIn}
              onSignUp={handleSignUp}
              onSignOut={handleSignOut}
              onResetPassword={handleResetPassword}
            />
            <ToastViewport />
          </ToastProvider>
        </QueryClientProvider>
      </div>
    );
  }

  // If auth is loading, show loading
  if (authState.isLoading) {
    return (
      <div
        ref={containerRef}
        className="w-full flex items-center justify-center"
        style={{ width: "500px", height: "600px" }}
      >
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <div className="text-center" style={{ color: "#013220" }}>
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
                style={{ borderColor: "#013220" }}
              ></div>
              <p>認証状態を確認中...</p>
            </div>
            <ToastViewport />
          </ToastProvider>
        </QueryClientProvider>
      </div>
    );
  }

  // User is authenticated, show main app
  return (
    <div ref={containerRef} className="min-h-0">
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          {view === "queue" ? (
            <Queue setView={setView} onSignOut={handleSignOut} />
          ) : view === "solutions" ? (
            <Solutions setView={setView} />
          ) : (
            <></>
          )}
          <ToastViewport />
        </ToastProvider>
      </QueryClientProvider>
    </div>
  );
};

export default App;
