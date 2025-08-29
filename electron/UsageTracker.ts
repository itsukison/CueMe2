interface UsageData {
  remaining: number
  limit: number
  used: number
}

class UsageCache {
  private data: UsageData | null = null
  private lastSync: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly STALE_TTL = 2 * 60 * 1000 // 2 minutes (refresh in background)
  
  constructor() {
    console.log('[UsageCache] Cache initialized')
  }
  
  isFresh(): boolean {
    return this.data !== null && (Date.now() - this.lastSync) < this.CACHE_TTL
  }
  
  isStale(): boolean {
    return this.data !== null && (Date.now() - this.lastSync) > this.STALE_TTL
  }
  
  canUse(count: number): boolean {
    return this.data !== null && this.data.remaining >= count
  }
  
  use(count: number): void {
    if (this.data) {
      this.data.remaining -= count
      this.data.used += count
      console.log(`[UsageCache] Used ${count}, remaining: ${this.data.remaining}`)
    }
  }
  
  update(data: UsageData): void {
    this.data = { ...data }
    this.lastSync = Date.now()
    console.log(`[UsageCache] Updated cache:`, this.data)
  }
  
  clear(): void {
    this.data = null
    this.lastSync = 0
    console.log('[UsageCache] Cache cleared')
  }
  
  getData(): UsageData | null {
    return this.data ? { ...this.data } : null
  }
}

export class UsageTracker {
  private webApiUrl: string
  private cache: UsageCache
  private backgroundSyncQueue: Array<{ count: number, timestamp: number }> = []
  private syncInProgress: boolean = false
  private lastUserToken: string | null = null

  constructor() {
    // Use production URL by default, with fallback to development
    this.webApiUrl = process.env.WEB_API_URL || 'https://www.cueme.ink'
    this.cache = new UsageCache()
    console.log(`[UsageTracker] Using API URL: ${this.webApiUrl}`);
  }

  async incrementQuestionUsage(userToken: string, count: number = 1): Promise<{ success: boolean; remaining?: number; error?: string }> {
    console.log(`[UsageTracker] Increment request: count=${count}`)
    
    // Store token for background sync
    this.lastUserToken = userToken
    
    // Try cache first for fast response
    if (this.cache.isFresh() && this.cache.canUse(count)) {
      console.log(`[UsageTracker] Using cache for increment`)
      this.cache.use(count)
      
      // Queue for background sync
      this.queueBackgroundSync(count)
      
      return {
        success: true,
        remaining: this.cache.getData()?.remaining
      }
    }
    
    // Fallback to server call
    console.log(`[UsageTracker] Cache miss, using server call`)
    return this.incrementUsageServer(userToken, count)
  }

  private async incrementUsageServer(userToken: string, count: number): Promise<{ success: boolean; remaining?: number; error?: string }> {
    try {
      console.log(`[UsageTracker] Starting server request to ${this.webApiUrl}/api/usage/increment`)
      console.log(`[UsageTracker] Token length: ${userToken.length}`)
      console.log(`[UsageTracker] Token preview: ${userToken.substring(0, 20)}...`)
      console.log(`[UsageTracker] Count: ${count}`)
      
      const response = await fetch(`${this.webApiUrl}/api/usage/increment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`,
        },
        body: JSON.stringify({ count })
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
      
      // Update cache with server response
      if (data.usage) {
        this.cache.update({
          remaining: data.usage.remaining,
          limit: data.usage.limit,
          used: data.usage.used
        })
      }
      
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

  async checkCanAskQuestion(userToken: string, count: number = 1): Promise<{ allowed: boolean; remaining?: number; error?: string }> {
    console.log(`[UsageTracker] Check request: count=${count}`)
    
    // Store token for background sync
    this.lastUserToken = userToken
    
    // Try cache first for fast response
    if (this.cache.isFresh()) {
      console.log(`[UsageTracker] Using cache for check`)
      const allowed = this.cache.canUse(count)
      const remaining = this.cache.getData()?.remaining ?? 0
      
      // Refresh cache in background if stale
      if (this.cache.isStale()) {
        console.log(`[UsageTracker] Cache is stale, refreshing in background`)
        this.refreshCacheInBackground(userToken)
      }
      
      return {
        allowed,
        remaining,
        error: allowed ? undefined : 'Insufficient usage remaining in cache'
      }
    }
    
    // Fallback to server call and update cache
    console.log(`[UsageTracker] Cache miss, checking with server`)
    return this.checkCanAskQuestionServer(userToken, count)
  }

  private async checkCanAskQuestionServer(userToken: string, count: number): Promise<{ allowed: boolean; remaining?: number; error?: string }> {
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
      const remaining = maxQuestions - usedQuestions
      
      // Update cache with fresh data
      this.cache.update({
        remaining,
        limit: maxQuestions,
        used: usedQuestions
      })
      
      if (remaining < count) {
        return {
          allowed: false,
          remaining,
          error: `Monthly limit of ${maxQuestions} questions would be exceeded. You have ${remaining} questions remaining.`
        }
      }

      return {
        allowed: true,
        remaining
      }
    } catch (error) {
      console.error(`[UsageTracker] Error checking usage limits at ${this.webApiUrl}/api/subscriptions/user:`, error)
      return {
        allowed: true, // Allow by default if we can't check (graceful degradation)
        error: 'Unable to check limits'
      }
    }
  }

  // Cache management methods
  public async initializeCache(userToken: string): Promise<void> {
    console.log('[UsageTracker] Initializing cache')
    
    // Store token for background sync
    this.lastUserToken = userToken
    
    try {
      await this.checkCanAskQuestionServer(userToken, 0) // 0 count just to fetch data
      console.log('[UsageTracker] Cache initialized successfully')
    } catch (error) {
      console.error('[UsageTracker] Failed to initialize cache:', error)
    }
  }

  public clearCache(): void {
    console.log('[UsageTracker] Clearing cache')
    this.cache.clear()
    this.backgroundSyncQueue = []
    this.lastUserToken = null // Clear token on logout
  }

  private queueBackgroundSync(count: number): void {
    this.backgroundSyncQueue.push({
      count,
      timestamp: Date.now()
    })
    
    // Process queue with some delay to batch requests
    setTimeout(() => this.processBackgroundSync(), 1000)
  }

  private async processBackgroundSync(): Promise<void> {
    if (this.syncInProgress || this.backgroundSyncQueue.length === 0) {
      return
    }

    this.syncInProgress = true
    const totalCount = this.backgroundSyncQueue.reduce((sum, item) => sum + item.count, 0)
    this.backgroundSyncQueue = [] // Clear queue

    console.log(`[UsageTracker] Background sync: ${totalCount} questions`)
    
    // Get current user token for server sync
    try {
      // We need to get the current user token to sync with server
      // This is a limitation - we need the token for background sync
      // For now, we'll store the last used token
      if (this.lastUserToken) {
        console.log(`[UsageTracker] Syncing ${totalCount} questions to server...`)
        const result = await this.incrementUsageServer(this.lastUserToken, totalCount)
        if (result.success) {
          console.log(`[UsageTracker] Background sync successful`)
        } else {
          console.error(`[UsageTracker] Background sync failed:`, result.error)
          // Re-queue the failed sync for retry later
          this.queueBackgroundSync(totalCount)
        }
      } else {
        console.warn(`[UsageTracker] No user token available for background sync, queueing for later`)
        // Re-queue for when token becomes available
        this.queueBackgroundSync(totalCount)
      }
    } catch (error) {
      console.error(`[UsageTracker] Background sync error:`, error)
      // Re-queue the failed sync for retry later
      this.queueBackgroundSync(totalCount)
    }
    
    this.syncInProgress = false
  }

  private async refreshCacheInBackground(userToken: string): Promise<void> {
    try {
      await this.checkCanAskQuestionServer(userToken, 0)
      console.log('[UsageTracker] Background cache refresh completed')
    } catch (error) {
      console.error('[UsageTracker] Background cache refresh failed:', error)
    }
  }
}