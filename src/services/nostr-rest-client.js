/**
 * REST API Client for Nostr relay interactions via REST2NOSTR proxy
 */

import config from '../config/index.js'

/**
 * NIP-01 max subscription id length. REST2NOSTR may append a short per-relay
 * suffix, so keep client ids well under 64.
 */
export const MAX_CLIENT_SUB_ID_LENGTH = 48

/**
 * Generate a unique subscription ID that stays within NIP-01 limits.
 * Use a short semantic prefix only (e.g. 'dm', 'group', 'profile', 'dm-notify').
 * Do not embed pubkeys or channel hex — those exceed the 64-char limit.
 *
 * @param {string} prefix - Short prefix for the subscription ID
 * @returns {string} Unique subscription ID
 */
export function generateSubId (prefix = 'sub') {
  let safePrefix = String(prefix || 'sub')

  // If a caller still passes `dm-${pubkey}` / `group-${channelId}`, drop the hex.
  const hexMatch = safePrefix.match(/[0-9a-f]{64}/i)
  if (hexMatch) {
    const cut = safePrefix.indexOf(hexMatch[0])
    safePrefix = safePrefix.slice(0, cut).replace(/-+$/, '') || 'sub'
  }

  safePrefix = safePrefix.slice(0, 20) || 'sub'
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).slice(2, 8)
  let subId = `${safePrefix}-${timestamp}-${random}`

  if (subId.length > MAX_CLIENT_SUB_ID_LENGTH) {
    subId = subId.slice(0, MAX_CLIENT_SUB_ID_LENGTH)
  }

  return subId
}

class NostrRestClient {
  constructor (localConfig = {}) {
    this.apiUrl = localConfig.apiUrl || config.nostrRestApiUrl
    this.activeSubscriptions = new Map() // Track active SSE subscriptions
  }

  /**
   * Publish a signed event to the relay
   * @param {Object} signedEvent - Signed Nostr event
   * @returns {Promise<Object>} Response with {accepted, message, eventId}
   */
  async publishEvent (signedEvent) {
    try {
      const response = await fetch(`${this.apiUrl}/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(signedEvent)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Error publishing event:', error)
      throw error
    }
  }

  /**
   * Query events statelessly (GET request)
   * @param {string} subId - Subscription ID
   * @param {Array|Object} filters - Filter object or array of filters
   * @returns {Promise<Array>} Array of events
   */
  async queryEvents (subId, filters) {
    try {
      // Ensure filters is an array
      const filtersArray = Array.isArray(filters) ? filters : [filters]

      // Encode filters as query parameter
      const filtersJson = encodeURIComponent(JSON.stringify(filtersArray))
      const url = `${this.apiUrl}/req/${subId}?filters=${filtersJson}`

      const response = await fetch(url)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const events = await response.json()
      return events
    } catch (error) {
      console.error('Error querying events:', error)
      throw error
    }
  }

  /**
   * Create a subscription for Server-Sent Events (SSE)
   * @param {string} subId - Subscription ID
   * @param {Array|Object} filters - Filter object or array of filters
   * @param {Object} callbacks - Callback functions {onEvent, onEose, onClosed, onError}
   * @returns {EventSource} EventSource instance for cleanup
   */
  createSubscription (subId, filters, callbacks = {}) {
    const { onEvent, onEose, onClosed, onError } = callbacks

    // Ensure filters is an array
    const filtersArray = Array.isArray(filters) ? filters : [filters]

    // Use POST method for SSE subscription
    // Note: EventSource doesn't support POST, so we'll use fetch with streaming
    // However, for simplicity and browser compatibility, we'll use a workaround:
    // Create a form and use POST, or use EventSource with GET if the server supports it

    // For now, we'll use fetch with streaming and parse SSE manually
    // This is more complex but allows POST with filters in body
    const abortController = new AbortController()

    const fetchSubscription = async () => {
      try {
        const response = await fetch(`${this.apiUrl}/req/${subId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream'
          },
          body: JSON.stringify(filtersArray),
          signal: abortController.signal
        })

        if (!response.ok) {
          const errorText = await response.text()
          if (onError) {
            onError(new Error(`HTTP ${response.status}: ${errorText}`))
          }
          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) // Remove 'data: ' prefix

                if (data.type === 'connected') {
                  // Connection established
                  console.log(`Subscription ${subId} connected`)
                } else if (data.type === 'event' && data.data) {
                  // Event received
                  if (onEvent) {
                    onEvent(data.data)
                  }
                } else if (data.type === 'eose') {
                  // End of stored events
                  if (onEose) {
                    onEose()
                  }
                } else if (data.type === 'closed') {
                  // Subscription closed
                  if (onClosed) {
                    onClosed(data.message || 'Subscription closed')
                  }
                  return // Stop reading
                }
              } catch (parseError) {
                console.warn('Error parsing SSE message:', parseError, line)
              }
            }
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          // Subscription was cancelled, this is expected
          return
        }
        console.error('Error in SSE subscription:', error)
        if (onError) {
          onError(error)
        }
      }
    }

    // Store subscription for cleanup. close() is the single entry point —
    // it aborts the stream and DELETEs on the server (do not also call
    // closeSubscription from effect cleanup).
    const subscription = {
      subId,
      abortController,
      close: () => {
        this.closeSubscription(subId)
      }
    }

    this.activeSubscriptions.set(subId, subscription)

    // Start the subscription
    fetchSubscription()

    return subscription
  }

  /**
   * Close an existing subscription
   * @param {string} subId - Subscription ID to close
   * @returns {Promise<void>}
   */
  async closeSubscription (subId) {
    try {
      // Abort the fetch if it's still active
      const subscription = this.activeSubscriptions.get(subId)
      if (subscription && subscription.abortController) {
        subscription.abortController.abort()
      }

      // Send DELETE request to close subscription
      const response = await fetch(`${this.apiUrl}/req/${subId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.warn(`Error closing subscription ${subId}:`, errorText)
      }

      // Remove from active subscriptions
      this.activeSubscriptions.delete(subId)
    } catch (error) {
      console.error(`Error closing subscription ${subId}:`, error)
      // Still remove from active subscriptions even if DELETE fails
      this.activeSubscriptions.delete(subId)
    }
  }

  /**
   * Close all active subscriptions
   */
  async closeAllSubscriptions () {
    const subIds = Array.from(this.activeSubscriptions.keys())
    await Promise.all(subIds.map(subId => this.closeSubscription(subId)))
  }
}

export default NostrRestClient
