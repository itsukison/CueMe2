// ipcHandlers.ts

import { ipcMain, app } from "electron"
import { AppState } from "./main"

export function initializeIpcHandlers(appState: AppState): void {
  ipcMain.handle(
    "update-content-dimensions",
    async (event, { width, height }: { width: number; height: number }) => {
      if (width && height) {
        appState.setWindowDimensions(width, height)
      }
    }
  )

  ipcMain.handle("delete-screenshot", async (event, path: string) => {
    return appState.deleteScreenshot(path)
  })

  ipcMain.handle("take-screenshot", async () => {
    try {
      const screenshotPath = await appState.takeScreenshot()
      const preview = await appState.getImagePreview(screenshotPath)
      return { path: screenshotPath, preview }
    } catch (error) {
      console.error("Error taking screenshot:", error)
      throw error
    }
  })

  ipcMain.handle("get-screenshots", async () => {
    console.log({ view: appState.getView() })
    try {
      let previews = []
      if (appState.getView() === "queue") {
        previews = await Promise.all(
          appState.getScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      } else {
        previews = await Promise.all(
          appState.getExtraScreenshotQueue().map(async (path) => ({
            path,
            preview: await appState.getImagePreview(path)
          }))
        )
      }
      previews.forEach((preview: any) => console.log(preview.path))
      return previews
    } catch (error) {
      console.error("Error getting screenshots:", error)
      throw error
    }
  })

  ipcMain.handle("toggle-window", async () => {
    appState.toggleMainWindow()
  })

  ipcMain.handle("reset-queues", async () => {
    try {
      appState.clearQueues()
      console.log("Screenshot queues have been cleared.")
      return { success: true }
    } catch (error: any) {
      console.error("Error resetting queues:", error)
      return { success: false, error: error.message }
    }
  })

  // IPC handler for analyzing audio from base64 data
  ipcMain.handle("analyze-audio-base64", async (event, data: string, mimeType: string) => {
    try {
      const result = await appState.processingHelper.processAudioBase64(data, mimeType)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-base64 handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing audio from file path
  ipcMain.handle("analyze-audio-file", async (event, path: string) => {
    try {
      const result = await appState.processingHelper.processAudioFile(path)
      return result
    } catch (error: any) {
      console.error("Error in analyze-audio-file handler:", error)
      throw error
    }
  })

  // IPC handler for analyzing image from file path
  ipcMain.handle("analyze-image-file", async (event, path: string) => {
    try {
      const result = await appState.processingHelper.getLLMHelper().analyzeImageFile(path)
      return result
    } catch (error: any) {
      console.error("Error in analyze-image-file handler:", error)
      throw error
    }
  })

  ipcMain.handle("gemini-chat", async (event, message: string) => {
    try {
      const result = await appState.processingHelper.getLLMHelper().chatWithGemini(message);
      return result;
    } catch (error: any) {
      console.error("Error in gemini-chat handler:", error);
      throw error;
    }
  });

  // RAG-enabled chat handler
  ipcMain.handle("gemini-chat-rag", async (event, message: string, collectionId?: string) => {
    try {
      const result = await appState.processingHelper.getLLMHelper().chatWithRAG(message, collectionId);
      return result;
    } catch (error: any) {
      console.error("Error in gemini-chat-rag handler:", error);
      throw error;
    }
  });

  // Authentication handlers
  ipcMain.handle("auth-sign-in", async (event, email: string, password: string) => {
    try {
      return await appState.authService.signInWithEmail(email, password);
    } catch (error: any) {
      console.error("Error in auth-sign-in handler:", error);
      throw error;
    }
  });

  ipcMain.handle("auth-sign-up", async (event, email: string, password: string) => {
    try {
      return await appState.authService.signUpWithEmail(email, password);
    } catch (error: any) {
      console.error("Error in auth-sign-up handler:", error);
      throw error;
    }
  });

  ipcMain.handle("auth-sign-out", async () => {
    try {
      return await appState.authService.signOut();
    } catch (error: any) {
      console.error("Error in auth-sign-out handler:", error);
      throw error;
    }
  });

  ipcMain.handle("auth-get-state", async () => {
    try {
      return appState.authService.getAuthState();
    } catch (error: any) {
      console.error("Error in auth-get-state handler:", error);
      throw error;
    }
  });

  ipcMain.handle("auth-reset-password", async (event, email: string) => {
    try {
      return await appState.authService.resetPassword(email);
    } catch (error: any) {
      console.error("Error in auth-reset-password handler:", error);
      throw error;
    }
  });

  // QnA Collection handlers
  ipcMain.handle("qna-get-collections", async () => {
    try {
      const user = appState.authService.getCurrentUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      return await appState.qnaService.getUserCollections(user.id);
    } catch (error: any) {
      console.error("Error in qna-get-collections handler:", error);
      throw error;
    }
  });

  ipcMain.handle("qna-get-collection", async (event, collectionId: string) => {
    try {
      return await appState.qnaService.getCollection(collectionId);
    } catch (error: any) {
      console.error("Error in qna-get-collection handler:", error);
      throw error;
    }
  });

  ipcMain.handle("qna-get-collection-items", async (event, collectionId: string) => {
    try {
      return await appState.qnaService.getCollectionItems(collectionId);
    } catch (error: any) {
      console.error("Error in qna-get-collection-items handler:", error);
      throw error;
    }
  });

  ipcMain.handle("qna-search-items", async (event, query: string, collectionId: string, threshold?: number, count?: number) => {
    try {
      return await appState.qnaService.searchQnAItems(query, collectionId, threshold, count);
    } catch (error: any) {
      console.error("Error in qna-search-items handler:", error);
      throw error;
    }
  });

  ipcMain.handle("qna-find-relevant", async (event, question: string, collectionId: string, threshold?: number) => {
    try {
      return await appState.qnaService.findRelevantAnswers(question, collectionId, threshold);
    } catch (error: any) {
      console.error("Error in qna-find-relevant handler:", error);
      throw error;
    }
  });

  ipcMain.handle("quit-app", () => {
    app.quit()
  })

  // Window movement handlers
  ipcMain.handle("move-window-left", async () => {
    appState.moveWindowLeft()
  })

  ipcMain.handle("move-window-right", async () => {
    appState.moveWindowRight()
  })

  ipcMain.handle("move-window-up", async () => {
    appState.moveWindowUp()
  })

  ipcMain.handle("move-window-down", async () => {
    appState.moveWindowDown()
  })

  ipcMain.handle("center-and-show-window", async () => {
    appState.centerAndShowWindow()
  })
}
