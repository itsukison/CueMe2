import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai"
import fs from "fs"
import { QnAService, SearchResult } from "./QnAService"

export interface RAGContext {
  hasContext: boolean
  results: SearchResult[]
  collectionName?: string
}

export class LLMHelper {
  private model: GenerativeModel
  private qnaService: QnAService | null = null
  private readonly systemPrompt = `You are Wingman AI, a helpful, proactive assistant for any kind of problem or situation (not just coding). For any user input, analyze the situation, provide a clear problem statement, relevant context, and suggest several possible responses or actions the user could take next. Always explain your reasoning. Present your suggestions as a list of options or next steps. When responding in Japanese, keep responses concise and structured for Japanese interview style - short, clear answers with easy to understand structure. Prioritize brevity while maintaining clarity. Format responses in a structured way with clear sections when appropriate.`

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey)
    this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
  }

  private async fileToGenerativePart(imagePath: string) {
    const imageData = await fs.promises.readFile(imagePath)
    return {
      inlineData: {
        data: imageData.toString("base64"),
        mimeType: "image/png"
      }
    }
  }

  private cleanJsonResponse(text: string): string {
    // Remove markdown code block syntax if present
    text = text.replace(/^```(?:json)?\n/, '').replace(/\n```$/, '');
    // Remove any leading/trailing whitespace
    text = text.trim();
    return text;
  }

  public async extractProblemFromImages(imagePaths: string[]) {
    try {
      const imageParts = await Promise.all(imagePaths.map(path => this.fileToGenerativePart(path)))
      
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Please analyze these images and extract the following information in JSON format:\n{
  "problem_statement": "A clear statement of the problem or situation depicted in the images.",
  "context": "Relevant background or context from the images.",
  "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
  "reasoning": "Explanation of why these suggestions are appropriate."
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks. When responding in Japanese, keep responses concise and structured for Japanese interview style.`

      const result = await this.model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      return JSON.parse(text)
    } catch (error) {
      console.error("Error extracting problem from images:", error)
      throw error
    }
  }

  public async generateSolution(problemInfo: any) {
    const prompt = `${this.systemPrompt}\n\nGiven this problem or situation:\n${JSON.stringify(problemInfo, null, 2)}\n\nPlease provide your response in the following JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks. When responding in Japanese, keep responses concise and structured for Japanese interview style - short, clear answers with easy to understand structure.`

    console.log("[LLMHelper] Calling Gemini LLM for solution...");
    try {
      const result = await this.model.generateContent(prompt)
      console.log("[LLMHelper] Gemini LLM returned result.");
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      const parsed = JSON.parse(text)
      console.log("[LLMHelper] Parsed LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("[LLMHelper] Error in generateSolution:", error);
      throw error;
    }
  }

  public async debugSolutionWithImages(problemInfo: any, currentCode: string, debugImagePaths: string[]) {
    try {
      const imageParts = await Promise.all(debugImagePaths.map(path => this.fileToGenerativePart(path)))
      
      const prompt = `${this.systemPrompt}\n\nYou are a wingman. Given:\n1. The original problem or situation: ${JSON.stringify(problemInfo, null, 2)}\n2. The current response or approach: ${currentCode}\n3. The debug information in the provided images\n\nPlease analyze the debug information and provide feedback in this JSON format:\n{
  "solution": {
    "code": "The code or main answer here.",
    "problem_statement": "Restate the problem or situation.",
    "context": "Relevant background/context.",
    "suggested_responses": ["First possible answer or action", "Second possible answer or action", "..."],
    "reasoning": "Explanation of why these suggestions are appropriate."
  }
}\nImportant: Return ONLY the JSON object, without any markdown formatting or code blocks. When responding in Japanese, keep responses concise and structured for Japanese interview style.`

      const result = await this.model.generateContent([prompt, ...imageParts])
      const response = await result.response
      const text = this.cleanJsonResponse(response.text())
      const parsed = JSON.parse(text)
      console.log("[LLMHelper] Parsed debug LLM response:", parsed)
      return parsed
    } catch (error) {
      console.error("Error debugging solution with images:", error)
      throw error
    }
  }

  public async analyzeAudioFile(audioPath: string) {
    try {
      const audioData = await fs.promises.readFile(audioPath);
      const audioPart = {
        inlineData: {
          data: audioData.toString("base64"),
          mimeType: "audio/mp3"
        }
      };
      const prompt = `${this.systemPrompt}\n\nDescribe this audio clip in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the audio. Do not return a structured JSON object, just answer naturally as you would to a user. When responding in Japanese, keep responses concise and structured for Japanese interview style - short, clear answers with easy to understand structure.`;
      const result = await this.model.generateContent([prompt, audioPart]);
      const response = await result.response;
      const text = response.text();
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing audio file:", error);
      throw error;
    }
  }

  public async analyzeAudioFromBase64(data: string, mimeType: string) {
    try {
      const audioPart = {
        inlineData: {
          data,
          mimeType
        }
      };
      const prompt = `${this.systemPrompt}\n\nDescribe this audio clip in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the audio. Do not return a structured JSON object, just answer naturally as you would to a user and be concise. When responding in Japanese, keep responses concise and structured for Japanese interview style - short, clear answers with easy to understand structure.`;
      const result = await this.model.generateContent([prompt, audioPart]);
      const response = await result.response;
      const text = response.text();
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing audio from base64:", error);
      throw error;
    }
  }

  public async analyzeImageFile(imagePath: string) {
    try {
      const imageData = await fs.promises.readFile(imagePath);
      const imagePart = {
        inlineData: {
          data: imageData.toString("base64"),
          mimeType: "image/png"
        }
      };
      const prompt = `${this.systemPrompt}\n\nDescribe the content of this image in a short, concise answer. In addition to your main answer, suggest several possible actions or responses the user could take next based on the image. Do not return a structured JSON object, just answer naturally as you would to a user. Be concise and brief. When responding in Japanese, keep responses concise and structured for Japanese interview style - short, clear answers with easy to understand structure.`;
      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      return { text, timestamp: Date.now() };
    } catch (error) {
      console.error("Error analyzing image file:", error);
      throw error;
    }
  }

  public async chatWithGemini(message: string): Promise<string> {
    try {
      // Add instruction for Japanese responses if detected
      const japaneseInstruction = "Keep responses concise and structured for Japanese interview style - short, clear answers with easy to understand structure. Use Japanese when appropriate.";
      const enhancedMessage = message + (message.includes("日本語") || message.includes("Japanese") ? `\n${japaneseInstruction}` : "");
      
      const result = await this.model.generateContent(enhancedMessage);
      const response = await result.response;
      let text = response.text();
      
      // If responding in Japanese, ensure brevity
      if (text.includes("日本") || text.includes("です") || text.includes("ます")) {
        // Add a gentle reminder about concise responses for Japanese
        text = text + "\n\n(簡潔で明確な日本語の回答を心がけています)";
      }
      
      return text;
    } catch (error) {
      console.error("[LLMHelper] Error in chatWithGemini:", error);
      throw error;
    }
  }

  public setQnAService(qnaService: QnAService) {
    this.qnaService = qnaService
  }

  private async searchRAGContext(
    message: string, 
    collectionId?: string
  ): Promise<RAGContext> {
    if (!this.qnaService || !collectionId) {
      return { hasContext: false, results: [] }
    }

    try {
      const searchResults = await this.qnaService.findRelevantAnswers(
        message,
        collectionId,
        0.7 // similarity threshold
      )

      return {
        hasContext: searchResults.hasRelevantAnswers,
        results: searchResults.answers
      }
    } catch (error) {
      console.error('[LLMHelper] Error searching RAG context:', error)
      return { hasContext: false, results: [] }
    }
  }

  private formatRAGPrompt(message: string, ragContext: RAGContext): string {
    if (!ragContext.hasContext || ragContext.results.length === 0) {
      return message
    }

    const contextInfo = ragContext.results
      .map((result, index) => {
        return `Reference ${index + 1} (relevance: ${result.similarity.toFixed(2)}):\nQ: ${result.question}\nA: ${result.answer}`
      })
      .join('\n\n---\n\n')

    return `Based on the following relevant information from the knowledge base:\n\n${contextInfo}\n\n---\n\nUser Question: ${message}\n\nPlease provide a comprehensive answer using the above context when relevant, but also feel free to add your own insights and suggestions.`
  }

  public async chatWithRAG(
    message: string,
    collectionId?: string
  ): Promise<{ response: string; ragContext: RAGContext }> {
    try {
      // Search for relevant context if collection is specified
      const ragContext = await this.searchRAGContext(message, collectionId)
      
      // Format the prompt with RAG context if available
      const enhancedMessage = this.formatRAGPrompt(message, ragContext)
      
      // Add instruction for Japanese responses if detected
      const japaneseInstruction = "Keep responses concise and structured for Japanese interview style - short, clear answers with easy to understand structure. Use Japanese when appropriate."
      const finalMessage = enhancedMessage + (message.includes("日本語") || message.includes("Japanese") ? `\n${japaneseInstruction}` : "")
      
      const result = await this.model.generateContent(finalMessage)
      const response = await result.response
      let text = response.text()
      
      // If responding in Japanese, ensure brevity
      if (text.includes("日本") || text.includes("です") || text.includes("ます")) {
        text = text + "\n\n(簡潔で明確な日本語の回答を心がけています)"
      }
      
      // Add context indicator if RAG was used
      if (ragContext.hasContext) {
        text = `📚 *Found ${ragContext.results.length} relevant reference(s)*\n\n${text}`
      }
      
      return {
        response: text,
        ragContext
      }
    } catch (error) {
      console.error("[LLMHelper] Error in chatWithRAG:", error)
      throw error
    }
  }
} 