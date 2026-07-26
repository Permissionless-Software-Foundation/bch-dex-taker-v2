/*
  Component for Nostr Chat functionality
*/

// Global npm libraries
import React, { useCallback, useEffect, useState, useRef } from 'react'
import { Container, Row, Col } from 'react-bootstrap'
import NostrRestClient, { generateSubId } from '../../../services/nostr-rest-client.js'

// Local libraries
import ChatSidebar from './chat-sidebar'
import ChatMain from './chat-main'
import config from '../../../config'

function NostrChat (props) {
  const { appData } = props
  const { nostrQueries, bchWalletState, startChannelChat } = appData
  // Initialize REST client for SSE subscriptions
  const restClient = useRef(new NostrRestClient())
  // Track active subscriptions for cleanup
  const subscriptionsRef = useRef({})

  const [messages, setMessages] = useState([])
  const [loadedMessages, setLoadedMessages] = useState(false)
  const [profiles, setProfiles] = useState({})
  const [channelsData, setChannelsData] = useState({})
  const [channelsLoaded, setChannelsLoaded] = useState(false)
  const [groupChannels] = useState(config.chatsId)
  const [dmChannels, setDmChannels] = useState([])
  const [dmListLoaded, setDmListLoaded] = useState(false)

  const [selectedChannel, setSelectedChannel] = useState(null)
  const [selectedChannelIsDm, setSelectedChannelIsDm] = useState(false)

  const [deletedChats] = useState(appData.nostrQueries.deletedChats)

  const profilesRef = useRef({})
  const dmChannelsRef = useRef([])
  const groupChannelsRef = useRef(config.chatsId)

  // True if channel id is a known DM peer (not a configured group channel).
  const isDmChannel = useCallback((ch) => {
    if (!ch) return false
    if (groupChannelsRef.current.includes(ch)) return false
    return dmChannelsRef.current.includes(ch) || !!profilesRef.current[ch]
  }, [])

  // Close one tracked SSE subscription (single cleanup path).
  const closeTrackedSubscription = useCallback((subId) => {
    const subscriptions = subscriptionsRef.current
    if (subscriptions[subId]) {
      subscriptions[subId].close()
      delete subscriptions[subId]
    }
  }, [])

  // Reset states on change channel
  const onChangeChannel = useCallback((ch) => {
    if (selectedChannel === ch) return
    setSelectedChannelIsDm(isDmChannel(ch))
    setMessages([])
    setLoadedMessages(false)
    setSelectedChannel(ch)
  }, [selectedChannel, isDmChannel])

  // Add a new DM to the list
  const addPrivateMessage = useCallback(async (profile) => {
    try {
      const exist = dmChannelsRef.current.find(val => val === profile.pubKey)
      setMessages([])
      setLoadedMessages(false)
      setSelectedChannelIsDm(true)
      setSelectedChannel(profile.pubKey)
      if (exist) return
      setDmChannels(currentChs => {
        let newChs = [...currentChs]
        newChs.push(profile.pubKey)
        newChs = newChs.filter((val, i, list) => {
          const existingIndex = list.findIndex(value => value === val)
          return existingIndex === i
        })
        dmChannelsRef.current = newChs
        return newChs
      })
      setChannelsData(currentChs => {
        const newChs = { ...currentChs }
        newChs[profile.pubKey] = profile
        return newChs
      })
    } catch (error) {
      console.warn(error)
    }
  }, [])

  // Define starter chat
  useEffect(() => {
    // Start dm if a initial chat is provided from props
    const startDM = async (pubKey) => {
      const npub = await appData.nostrQueries.hexToNpub(pubKey)

      const defaultProfile = { name: npub } // default profile
      profilesRef.current[pubKey] = defaultProfile // update ref , to prevent fetch this profile again.
      // Fetch profile
      const nostrProfile = await appData.nostrQueries.getProfile(pubKey)

      const profile = nostrProfile || defaultProfile
      // add public key formats to profile object
      profile.pubKey = pubKey
      profile.npub = npub
      // Update profiles state
      setProfiles(currentProfiles => {
        const newProfiles = { ...currentProfiles }
        newProfiles[pubKey] = profile
        profilesRef.current = newProfiles
        return newProfiles
      })
      await addPrivateMessage(profile)
    }

    if (selectedChannel) return
    if (!startChannelChat) {
      // Set group chat as initial chat
      setSelectedChannel(config.chatsId[0])
      setSelectedChannelIsDm(false)
    } else if (dmListLoaded) {
      // Set provided profile as initial chat
      startDM(startChannelChat)
    }
  }, [appData, startChannelChat, dmListLoaded, addPrivateMessage, selectedChannel])

  // Handle read messages
  const onMsgRead = useCallback(async (ev) => {
    try {
      // Update messages list
      setMessages(current => {
        // ignore existing messages
        const exist = current.find(val => val.id === ev.id)
        if (exist) return current

        const newMsgs = [...current]
        newMsgs.push(ev)

        // Sort messages by timestamp
        newMsgs.sort((a, b) => b.created_at - a.created_at)
        return newMsgs.reverse()
      })

      // Fetch message owner profile
      const pubKey = ev.pubkey
      const existProfile = profilesRef.current[ev.pubkey]
      if (existProfile) {
        return
      }
      const npub = await appData.nostrQueries.hexToNpub(pubKey)

      console.log(`Trying to get ${pubKey} profile.`)

      const defaultProfile = { name: npub } // default profile
      profilesRef.current[pubKey] = defaultProfile // update ref , to prevent fetch this profile again.
      // Fetch profile
      const nostrProfile = await appData.nostrQueries.getProfile(pubKey)

      const profile = nostrProfile || defaultProfile
      // add public key formats to profile object
      profile.pubKey = pubKey
      profile.npub = npub
      // Update profiles state
      setProfiles(currentProfiles => {
        const newProfiles = { ...currentProfiles }
        newProfiles[pubKey] = profile
        profilesRef.current = newProfiles
        return newProfiles
      })
    } catch (error) {
      console.warn(error)
    }
  }, [appData])

  const decryptMsg = useCallback(async ({ ev, pubKey }) => {
    try {
      const encryptedMsg = ev.content
      const senderPubKey = pubKey

      const { nostrKeyPair } = appData.bchWalletState
      const { nostrQueries } = appData
      const decryptData = {
        receiverPrivKey: nostrKeyPair.privHex,
        senderPubKey,
        encryptedMsg
      }

      const decrptedMsg = await nostrQueries.decryptMsg(decryptData)

      ev.content = decrptedMsg
      onMsgRead(ev)
    } catch (error) {
      console.warn(error)
    }
  }, [appData, onMsgRead])

  // Load group history via GET, then SSE for live messages only
  useEffect(() => {
    if (!selectedChannel || !channelsLoaded || selectedChannelIsDm) return
    if (!deletedChats || !Array.isArray(deletedChats)) return

    let cancelled = false
    const subId = generateSubId('group')

    const loadGroup = async () => {
      try {
        const history = await nostrQueries.getChannelMessages(selectedChannel, 50)
        if (cancelled) return

        for (const ev of history) {
          const onBlackList = nostrQueries.blackList.find((val) => val === ev.pubkey)
          const isDeleted = deletedChats.find((val) => val.eventId === ev.id)
          if (!onBlackList && !isDeleted) {
            onMsgRead(ev)
          }
        }

        if (!cancelled) {
          setLoadedMessages(true)
        }

        if (cancelled) return

        const newest = history.reduce((max, ev) => Math.max(max, ev.created_at || 0), 0)
        const liveFilter = {
          limit: 0,
          kinds: [42],
          '#e': [selectedChannel],
          ...(newest > 0 ? { since: newest } : {})
        }

        const subscription = restClient.current.createSubscription(subId, liveFilter, {
          onEvent: (ev) => {
            console.log('Group post retrieved from REST API', ev.content)
            const onBlackList = nostrQueries.blackList.find((val) => val === ev.pubkey)
            const isDeleted = deletedChats.find((val) => val.eventId === ev.id)
            if (!onBlackList && !isDeleted) {
              onMsgRead(ev)
            }
          },
          onEose: () => {},
          onClosed: (message) => {
            console.log('Group channel subscription closed:', message)
          },
          onError: (error) => {
            console.warn('Group channel subscription error:', error)
          }
        })

        if (cancelled) {
          subscription.close()
          return
        }

        subscriptionsRef.current[subId] = subscription
      } catch (error) {
        console.warn('Error loading group messages:', error)
        if (!cancelled) setLoadedMessages(true)
      }
    }

    loadGroup()

    return () => {
      cancelled = true
      console.log('Close existing subscription for group channel')
      closeTrackedSubscription(subId)
    }
  }, [onMsgRead, selectedChannel, selectedChannelIsDm, nostrQueries, channelsLoaded, deletedChats, closeTrackedSubscription])

  // Load DM history via GET, then SSE for live messages only
  useEffect(() => {
    if (!selectedChannel || !selectedChannelIsDm) return

    let cancelled = false
    const { nostrKeyPair } = bchWalletState
    const dmPubKey = selectedChannel
    const subId = generateSubId('dm')

    const loadDm = async () => {
      try {
        const history = await nostrQueries.getDmMessages(nostrKeyPair.pubHex, dmPubKey, 50)
        if (cancelled) return

        for (const ev of history) {
          if (ev.pubkey === nostrKeyPair.pubHex) {
            await decryptMsg({ ev, pubKey: dmPubKey })
          } else {
            await decryptMsg({ ev, pubKey: ev.pubkey })
          }
        }

        if (!cancelled) {
          setLoadedMessages(true)
        }

        if (cancelled) return

        const newest = history.reduce((max, ev) => Math.max(max, ev.created_at || 0), 0)
        const liveFilters = [
          {
            limit: 0,
            kinds: [4],
            '#p': [nostrKeyPair.pubHex],
            authors: [dmPubKey],
            ...(newest > 0 ? { since: newest } : {})
          },
          {
            limit: 0,
            kinds: [4],
            '#p': [dmPubKey],
            authors: [nostrKeyPair.pubHex],
            ...(newest > 0 ? { since: newest } : {})
          }
        ]

        const subscription = restClient.current.createSubscription(subId, liveFilters, {
          onEvent: (ev) => {
            console.log('DM post retrieved from REST API', ev.content)
            if (ev.pubkey === nostrKeyPair.pubHex) {
              decryptMsg({ ev, pubKey: dmPubKey })
            } else {
              decryptMsg({ ev, pubKey: ev.pubkey })
            }
          },
          onEose: () => {},
          onClosed: (message) => {
            console.log('DM channel subscription closed:', message)
          },
          onError: (error) => {
            console.warn('DM channel subscription error:', error)
          }
        })

        if (cancelled) {
          subscription.close()
          return
        }

        subscriptionsRef.current[subId] = subscription
      } catch (error) {
        console.warn('Error loading DM messages:', error)
        if (!cancelled) setLoadedMessages(true)
      }
    }

    loadDm()

    return () => {
      cancelled = true
      console.log('Close existing subscription for private channel')
      closeTrackedSubscription(subId)
    }
  }, [selectedChannel, selectedChannelIsDm, nostrQueries, bchWalletState, decryptMsg, closeTrackedSubscription])

  const handleIncomingDms = useCallback(async (pubKey) => {
    try {
      if (!dmListLoaded) return
      const exist = dmChannelsRef.current.find(val => val === pubKey)
      if (exist) return

      let profile = await nostrQueries.getProfile(pubKey)
      const npub = nostrQueries.hexToNpub(pubKey)
      if (!profile) profile = { name: npub }
      // add public key formats to profile object
      profile.pubKey = pubKey
      profile.npub = npub
      setProfiles(currentProfiles => {
        const newProfiles = { ...currentProfiles }
        newProfiles[pubKey] = profile
        profilesRef.current = newProfiles
        return newProfiles
      })
      setDmChannels(currentChs => {
        const newChs = [...currentChs]
        newChs.push(profile.pubKey)

        dmChannelsRef.current = newChs
        return newChs
      })
      setChannelsData(currentChs => {
        const newChs = { ...currentChs }
        newChs[profile.pubKey] = profile
        return newChs
      })
    } catch (error) {
      console.warn(error)
    }
  }, [nostrQueries, dmListLoaded])

  // Keep live subscription for new DMs
  useEffect(() => {
    if (!dmListLoaded || !channelsLoaded) return
    const { bchWalletState } = appData
    const { nostrKeyPair } = bchWalletState

    const subId = generateSubId('dm-notify')
    const filter = { limit: 0, kinds: [4], '#p': [nostrKeyPair.pubHex] }

    const subscription = restClient.current.createSubscription(subId, filter, {
      onEvent: (ev) => {
        console.log('New message received from REST API', ev)
        handleIncomingDms(ev.pubkey)
      },
      onEose: () => {},
      onClosed: (message) => {
        console.log('DM notification subscription closed:', message)
      },
      onError: (error) => {
        console.warn('DM notification subscription error:', error)
      }
    })

    subscriptionsRef.current[subId] = subscription

    return () => {
      console.log('Close existing subscription for DM notifications')
      closeTrackedSubscription(subId)
    }
  }, [handleIncomingDms, appData, dmListLoaded, channelsLoaded, closeTrackedSubscription])

  // Load Dm channels
  useEffect(() => {
    const loadCurrentDms = async () => {
      const { nostrQueries, bchWalletState } = appData
      const { nostrKeyPair } = bchWalletState
      const dms = await appData.nostrQueries.getDms(nostrKeyPair.pubHex)
      setDmChannels(currentChs => {
        let newChs = [...currentChs, ...dms]
        newChs = newChs.filter((val, i, list) => {
          const existingIndex = list.findIndex(value => value === val)
          return existingIndex === i
        })
        dmChannelsRef.current = newChs
        return newChs
      })
      setDmListLoaded(true)

      console.log('dm list', dms)

      for (let i = 0; i < dms.length; i++) {
        const pubKey = dms[i]
        const npub = await nostrQueries.hexToNpub(pubKey)

        const defaultProfile = { name: npub } // default profile
        profilesRef.current[pubKey] = defaultProfile // update ref , to prevent fetch this profile again.
        // Fetch profile
        const nostrProfile = await nostrQueries.getProfile(pubKey)

        const profile = nostrProfile || defaultProfile
        // add public key formats to profile object
        profile.pubKey = pubKey
        profile.npub = npub
        // Update profiles state
        setProfiles(currentProfiles => {
          const newProfiles = { ...currentProfiles }
          newProfiles[pubKey] = profile
          profilesRef.current = newProfiles
          return newProfiles
        })
      }
    }

    if (!dmListLoaded) loadCurrentDms()
  }, [appData, dmListLoaded])

  // Load public channels data
  useEffect(() => {
    const loadChData = async () => {
      const loadedChannels = []
      for (let i = 0; i < groupChannels.length; i++) {
        const ch = groupChannels[i]

        const exist = loadedChannels.find((val) => { return val === ch })
        if (exist) { continue }
        // Fech profile.
        let channelData = await appData.nostrQueries.getChannelInfo(ch)
        console.log('channelData', channelData)
        // Set short id as name
        if (!channelData) channelData = { name: ch.slice(0, 8) + '...' + ch.slice(-5) }
        loadedChannels.push(channelData)

        // Update channels data state
        setChannelsData(currentChs => {
          const newChs = { ...currentChs }
          newChs[ch] = channelData
          return newChs
        })
        setChannelsLoaded(true)
      }
    }

    loadChData()
  }, [selectedChannel, appData, groupChannels])

  return (
    <>
      <Container fluid className='h-100 p-0 mb-5 '>
        <Row className='h-100 g-0'>
          <Col xs={12} md={4} lg={3} className='h-100'>
            <ChatSidebar
              groupChannels={groupChannels}
              dmChannels={dmChannels}
              selectedChannel={selectedChannel}
              selectedChannelIsDm={selectedChannelIsDm}
              profiles={profiles}
              channelsData={channelsData}
              onChangeChannel={onChangeChannel}
              dmListLoaded={dmListLoaded && channelsLoaded}
              {...props}
            />
          </Col>
          <Col xs={12} md={8} lg={9} className='h-100 pe-2'>
            <ChatMain
              loadedMessages={loadedMessages}
              selectedChannel={selectedChannel}
              selectedChannelIsDm={selectedChannelIsDm}
              messages={messages}
              profiles={profiles}
              channelsData={channelsData}
              dmListLoaded={dmListLoaded && channelsLoaded}
              onChangeChannel={onChangeChannel}
              addPrivateMessage={addPrivateMessage}
              onMsgRead={onMsgRead}
              {...props}
            />
          </Col>
        </Row>
      </Container>
    </>
  )
}

export default NostrChat
