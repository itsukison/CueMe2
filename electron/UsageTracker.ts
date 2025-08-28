export class UsageTracker {
  private webApiUrl: string

  constructor() {
    // This should match your web app URL
    this.webApiUrl = process.env.WEB_API_URL || 'http://localhost:3001'
  }

  async incrementQuestionUsage(userToken: string): Promise<{ success: boolean; remaining?: number; error?: string }> {
    try {
      const response = await fetch(`${this.webApiUrl}/api/usage/increment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
      })

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limit exceeded
          const data = await response.json()
          return {
            success: false,
            error: data.error || 'Monthly question limit exceeded'
          }
        }
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      return {
        success: true,
        remaining: data.usage?.remaining
      }
    } catch (error) {
      console.error('Error incrementing usage:', error)
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
      console.error('Error checking usage limits:', error)
      return {
        allowed: true, // Allow by default if we can't check (graceful degradation)
        error: 'Unable to check limits'
      }
    }
  }
}