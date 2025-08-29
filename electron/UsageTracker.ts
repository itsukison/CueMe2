export class UsageTracker {
  private webApiUrl: string

  constructor() {
    // Use production URL by default, with fallback to development
    this.webApiUrl = process.env.WEB_API_URL || 'https://www.cueme.ink'
    console.log(`[UsageTracker] Using API URL: ${this.webApiUrl}`);
  }

  async incrementQuestionUsage(userToken: string): Promise<{ success: boolean; remaining?: number; error?: string }> {
    try {
      console.log(`[UsageTracker] Starting request to ${this.webApiUrl}/api/usage/increment`)
      console.log(`[UsageTracker] Token length: ${userToken.length}`)
      console.log(`[UsageTracker] Token preview: ${userToken.substring(0, 20)}...`)
      
      const response = await fetch(`${this.webApiUrl}/api/usage/increment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
      })

      console.log(`[UsageTracker] Response status: ${response.status}`)
      console.log(`[UsageTracker] Response headers:`, Object.fromEntries(response.headers.entries()))

      if (!response.ok) {
        // Try to get response body for error details
        let errorBody = '';
        try {
          errorBody = await response.text();
          console.log(`[UsageTracker] Error response body:`, errorBody);
        } catch (e) {
          console.log(`[UsageTracker] Could not read error response body:`, e);
        }

        if (response.status === 429) {
          // Rate limit exceeded
          let data: any = {};
          try {
            data = JSON.parse(errorBody);
          } catch (e) {
            console.log(`[UsageTracker] Could not parse 429 response as JSON`);
          }
          return {
            success: false,
            error: data.error || 'Monthly question limit exceeded'
          }
        }
        throw new Error(`HTTP ${response.status}: ${errorBody}`)
      }

      const responseText = await response.text();
      console.log(`[UsageTracker] Success response body:`, responseText);
      
      const data = JSON.parse(responseText);
      return {
        success: true,
        remaining: data.usage?.remaining
      }
    } catch (error) {
      console.error(`[UsageTracker] Error incrementing usage at ${this.webApiUrl}/api/usage/increment:`, error)
      console.error(`[UsageTracker] Error type:`, typeof error)
      console.error(`[UsageTracker] Error stack:`, error instanceof Error ? error.stack : 'No stack available')
      return {
        success: false,
        error: 'Failed to track usage'
      }
    }
  }

  async checkCanAskQuestion(userToken: string): Promise<{ allowed: boolean; remaining?: number; error?: string }> {
    try {
      const response = await fetch(`${this.webApiUrl}/api/subscriptions/user`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const subscription = data.subscription
      const usage = data.usage
      
      if (!subscription?.subscription_plans) {
        return { allowed: false, error: 'No subscription found' }
      }

      const maxQuestions = subscription.subscription_plans.max_monthly_questions
      const usedQuestions = usage.questions_used || 0
      
      if (usedQuestions >= maxQuestions) {
        return {
          allowed: false,
          error: `Monthly limit of ${maxQuestions} questions exceeded. You have used ${usedQuestions} questions.`
        }
      }

      return {
        allowed: true,
        remaining: maxQuestions - usedQuestions
      }
    } catch (error) {
      console.error(`[UsageTracker] Error checking usage limits at ${this.webApiUrl}/api/subscriptions/user:`, error)
      return {
        allowed: true, // Allow by default if we can't check (graceful degradation)
        error: 'Unable to check limits'
      }
    }
  }
}