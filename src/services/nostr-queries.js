/**
 *  Nostr class for query into relay pools
 *  Refactored to use REST API instead of WebSocket
 */
import NostrRestClient, { generateSubId } from './nostr-rest-client.js'
import * as nip19 from 'nostr-tools/nip19'
import { nip04 } from 'nostr-tools'
import { hexToBytes } from '@noble/hashes/utils' // already an installed dependency
import axios from 'axios'
import config from '../config'

const SERVER = `${config.dexServer}/`

export default class NostrQueries {
  constructor ({ relays }) {
    // Keep relays property for backward compatibility (empty array)
    this.relays = []

    // Initialize REST client
    this.restClient = new NostrRestClient()

    this.loadedProfiles = {}
    this.loadedChannelsInfo = {}
    this.blackList = []
    this.blackListFetched = false

    this.deletedChats = []
    this.deletedPosts = []
  }

  async start () {
    try {
      await this.getBlackList()
      await this.fetchDeletedChats()
      await this.fetchDeletedPosts()
    } catch (error) {
      console.error('NostrQueries.start() error : ', error.message)
      throw error
    }
  }

  setRelays (relays) {
    // No-op for backward compatibility (REST API handles relays server-side)
    this.relays = []
  }

  npubToHex (npub) {
    const pubHexData = nip19.decode(npub)
    const pubHex = pubHexData.data
    return pubHex
  }

  hexToNpub (hex) {
    return nip19.npubEncode(hex)
  }

  // Load profile from nostr relays via REST API
  async getProfile (pubHex) {
    try {
      const existingProfile = this.loadedProfiles[pubHex]
      if (existingProfile) {
        console.log(`Returning profile from cache :  ${existingProfile.name}`)
        return existingProfile
      }

      const subId = generateSubId('profile')
      const filter = { limit: 5, kinds: [0], authors: [pubHex] }

      const events = await this.restClient.queryEvents(subId, filter)

      // Find the most recent profile event (kind 0 events are replaceable)
      if (events && events.length > 0) {
        // Sort by created_at descending to get most recent
        events.sort((a, b) => b.created_at - a.created_at)
        const profileEvent = events[0]
        try {
          const profile = JSON.parse(profileEvent.content)
          console.log(`Profile found for ${pubHex}`)
          this.loadedProfiles[pubHex] = profile
          return profile
        } catch (error) {
          console.warn(`Error parsing profile content for ${pubHex}:`, error)
          return false
        }
      }

      return false
    } catch (error) {
      console.warn(`Error fetching profile for ${pubHex}:`, error)
      return false
    }
  }

  // Get Feeds by user pubkey via REST API
  async getUserFeeds (pubHex) {
    try {
      const subId = generateSubId('user-feeds')
      const filter = { limit: 5, kinds: [1], authors: [pubHex] }

      let feeds = await this.restClient.queryEvents(subId, filter)

      // Remove duplicated feeds
      feeds = feeds.filter((val, i, list) => {
        const existingIndex = list.findIndex(value => value.id === val.id)
        return existingIndex === i
      })

      // Sort from newest to oldest
      feeds.sort((a, b) => b.created_at - a.created_at)

      return feeds || []
    } catch (error) {
      console.warn(`Error fetching user feeds for ${pubHex}:`, error)
      return []
    }
  }

  // Get global feeds via REST API
  async getGlobalFeeds () {
    try {
      const subId = generateSubId('global-feeds')
      const filter = { limit: 10, kinds: [1], '#t': ['slpdex-socialmedia'] }

      let feeds = await this.restClient.queryEvents(subId, filter)

      // Filter out deleted posts
      feeds = feeds.filter((ev) => {
        const isDeleted = this.deletedPosts.find((val) => { return val.eventId === ev.id })
        return !isDeleted
      })

      // Remove duplicated feeds
      feeds = feeds.filter((val, i, list) => {
        const existingIndex = list.findIndex(value => value.id === val.id)
        return existingIndex === i
      })

      // Sort from newest to oldest
      feeds.sort((a, b) => b.created_at - a.created_at)

      return feeds || []
    } catch (error) {
      console.warn('Error fetching global feeds:', error)
      return []
    }
  }

  // Get follow list by pubkey via REST API
  async getFollowList (pubHex) {
    try {
      const subId = generateSubId('follow-list')
      const filter = { limit: 1, kinds: [3], authors: [pubHex] }

      const events = await this.restClient.queryEvents(subId, filter)

      // Get the most recent follow list (kind 3 events are replaceable)
      if (events && events.length > 0) {
        // Sort by created_at descending to get most recent
        events.sort((a, b) => b.created_at - a.created_at)
        const followListEvent = events[0]
        return followListEvent.tags || []
      }

      return []
    } catch (error) {
      console.warn(`Error fetching follow list for ${pubHex}:`, error)
      return []
    }
  }

  // Get event likes via REST API
  async getPostLikes (postId) {
    try {
      const subId = generateSubId('post-likes')
      const filter = { kinds: [7], '#e': [postId] }

      let likesRes = await this.restClient.queryEvents(subId, filter)

      // Remove duplicated events
      likesRes = likesRes.filter((val, i, list) => {
        const existingIndex = list.findIndex(value => value.id === val.id)
        return existingIndex === i
      })

      // Get likes
      const likesArr = likesRes.filter((val, i, list) => {
        return val.content === '+'
      })

      // Get dislikes
      const dislikesArr = likesRes.filter((val, i, list) => {
        return val.content === '-'
      })

      // For every user dislike remove a user like from the array
      for (let i = 0; i < dislikesArr.length; i++) {
        const disLike = dislikesArr[i]
        const likeExist = likesArr.findIndex(val => val.pubkey === disLike.pubkey)
        if (likeExist >= 0) likesArr.splice(likeExist, 1)
      }

      // Return array of likes.
      return likesArr
    } catch (error) {
      console.warn(`Error fetching post likes for ${postId}:`, error)
      return []
    }
  }

  async getChannelInfo (channelId) {
    try {
      const existingChInfo = this.loadedChannelsInfo[channelId]
      if (existingChInfo) {
        console.log(`Returning ch info from cache :  ${existingChInfo.name}`)
        return existingChInfo
      }

      const subId = generateSubId('channel-info')
      const filter = { limit: 1, kinds: [41], '#e': [channelId] }

      const events = await this.restClient.queryEvents(subId, filter)

      if (events && events.length > 0) {
        // Sort by created_at descending to get most recent
        events.sort((a, b) => b.created_at - a.created_at)
        const channelEvent = events[0]
        try {
          const chInfo = JSON.parse(channelEvent.content)
          this.loadedChannelsInfo[channelId] = chInfo
          return chInfo
        } catch (error) {
          console.warn(`Error parsing channel info for ${channelId}:`, error)
          return false
        }
      }

      return false
    } catch (error) {
      console.warn(`Error fetching channel info for ${channelId}:`, error)
      return false
    }
  }

  // Get associated pub keys from kind 04 inbox via REST API
  async getDms (pubKey) {
    try {
      const subId = generateSubId('dms')
      // Use array of filters for multiple conditions
      const filters = [
        { limit: 100, kinds: [4], '#p': [pubKey] }, // received messages
        { limit: 100, kinds: [4], authors: [pubKey] } // sent messages
      ]

      const events = await this.restClient.queryEvents(subId, filters)

      const list = []
      for (const ev of events) {
        if (ev.pubkey === pubKey) {
          // Sent message - get recipient from tags
          if (ev.tags && ev.tags.length > 0 && ev.tags[0][0] === 'p') {
            list.push(ev.tags[0][1])
          }
        } else {
          // Received message - get sender pubkey
          list.push(ev.pubkey)
        }
      }

      // Remove duplicated pubkeys
      const dms = list.filter((val, i, list) => {
        const existingIndex = list.findIndex(value => value === val)
        return existingIndex === i
      })

      return dms
    } catch (error) {
      console.warn(`Error fetching DMs for ${pubKey}:`, error)
      return []
    }
  }

  /**
   * Load DM conversation history between myPub and peerPub (kind 4).
   * Prefer this GET query over SSE for initial history.
   */
  async getDmMessages (myPub, peerPub, limit = 50) {
    try {
      const subId = generateSubId('dm-hist')
      const filters = [
        { limit, kinds: [4], '#p': [myPub], authors: [peerPub] },
        { limit, kinds: [4], '#p': [peerPub], authors: [myPub] }
      ]

      let events = await this.restClient.queryEvents(subId, filters)

      events = events.filter((val, i, list) => {
        const existingIndex = list.findIndex(value => value.id === val.id)
        return existingIndex === i
      })

      events.sort((a, b) => a.created_at - b.created_at)
      return events || []
    } catch (error) {
      console.warn(`Error fetching DM messages for ${peerPub}:`, error)
      return []
    }
  }

  /**
   * Load group channel message history (kind 42).
   */
  async getChannelMessages (channelId, limit = 50) {
    try {
      const subId = generateSubId('ch-hist')
      const filter = { limit, kinds: [42], '#e': [channelId] }

      let events = await this.restClient.queryEvents(subId, filter)

      events = events.filter((val, i, list) => {
        const existingIndex = list.findIndex(value => value.id === val.id)
        return existingIndex === i
      })

      events.sort((a, b) => a.created_at - b.created_at)
      return events || []
    } catch (error) {
      console.warn(`Error fetching channel messages for ${channelId}:`, error)
      return []
    }
  }

  async encryptMsg (inObj = {}) {
    try {
      const { senderPrivKey, receiverPubKey, message } = inObj
      const privateKeyBin = hexToBytes(senderPrivKey)
      const encryptedMsg = await nip04.encrypt(privateKeyBin, receiverPubKey, message)
      console.log('encryptedMsg', encryptedMsg)
      return encryptedMsg
    } catch (error) {
      console.warn(error)
      throw error
    }
  }

  async decryptMsg (inObj = {}) {
    try {
      console.log(inObj)
      const { receiverPrivKey, senderPubKey, encryptedMsg } = inObj
      const privateKeyBin = hexToBytes(receiverPrivKey)
      const decryptedMsg = await nip04.decrypt(privateKeyBin, senderPubKey, encryptedMsg)
      console.log('decryptedMsg', decryptedMsg)
      return decryptedMsg
    } catch (error) {
      console.warn(error)
      throw error
    }
  }

  async getBlackList () {
    try {
      if (this.blackListFetched) return
      const opts = {
        method: 'GET',
        url: 'https://blacklists.psfoundation.info/nostr-chat-blacklist.json',
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const result = await axios.request(opts)
      const { data } = result
      const { npubs } = data

      // // Dev test mock npub for testing purposes
      // const myNpubMock = 'npub1y3xq402pu9aqms3khetnt5gzm54t63pzcla56wwfmwshde0ws77qkff5gc'
      // npubs.push(myNpubMock)
      // //

      this.blackListFetched = true
      for (let i = 0; i < npubs.length; i++) {
        const npub = npubs[i]
        const pubKey = this.npubToHex(npub)
        this.blackList.push(pubKey)
      }
      console.log('BlackList ', this.blackList)

      return data
    } catch (error) {
      console.log('Error on getBlackList()')
      throw error
    }
  }

  // Get all deleted chats
  async fetchDeletedChats () {
    try {
      const options = {
        method: 'GET',
        url: `${SERVER}nostr/deletedChat`
      }
      const result = await axios.request(options)
      const { deletedChats } = result.data
      this.deletedChats = deletedChats
    } catch (error) {
      console.error('Error fetchDeletedChats: ', error)
      throw error
    }
  }

  // Get all deleted posts
  async fetchDeletedPosts () {
    try {
      const options = {
        method: 'GET',
        url: `${SERVER}nostr/deletedPost`
      }
      const result = await axios.request(options)
      console.log('result', result)
      const { deletedPosts } = result.data
      console.log('deletedPosts', deletedPosts)

      this.deletedPosts = deletedPosts
    } catch (error) {
      console.error('Error fetchDeletedPosts: ', error)
      throw error
    }
  }
}
