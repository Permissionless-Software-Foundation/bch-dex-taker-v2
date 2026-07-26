/*
  Component for the message input area
*/

// Global npm libraries
import React, { useState, useEffect } from 'react'
import { Form, Button, InputGroup } from 'react-bootstrap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPaperPlane } from '@fortawesome/free-solid-svg-icons'
import { finalizeEvent } from 'nostr-tools/pure'
import { hexToBytes } from '@noble/hashes/utils' // already an installed dependency
import NostrRestClient from '../../../services/nostr-rest-client.js'

function MessageInput (props) {
  const { appData, selectedChannel, profiles, selectedChannelIsDm, onMsgRead } = props
  const { bchWalletState, nostrQueries } = appData
  // Initialize REST client for publishing
  const restClient = new NostrRestClient()
  const [isDm, setIsDm] = useState(false)
  const [dmProfile, setDmProfile] = useState(false)
  const [message, setMessage] = useState('')
  const [onFetch, setOnFetch] = useState(false)

  // Define input type between private or public
  useEffect(() => {
    const dmTo = profiles[selectedChannel]
    // Prefer explicit DM channel flag; fall back to profile presence
    const privateChat = selectedChannelIsDm || !!dmTo
    setIsDm(privateChat)
    setDmProfile(dmTo || (privateChat ? { pubKey: selectedChannel } : false))
  }, [selectedChannel, profiles, selectedChannelIsDm])

  const handleSubmitPrivate = async (e) => {
    e.preventDefault()

    try {
      setOnFetch(true)
      console.log('dm To : ', dmProfile)

      const { nostrKeyPair } = bchWalletState
      const peerPubKey = dmProfile?.pubKey || selectedChannel
      // Convert private key to binary
      const privateKeyBin = hexToBytes(nostrKeyPair.privHex)
      const plaintext = message

      const encryptedMsg = await nostrQueries.encryptMsg({
        senderPrivKey: nostrKeyPair.privHex,
        receiverPubKey: peerPubKey,
        message: plaintext
      })

      console.log('encryptedMsg', encryptedMsg)
      // Generate a post.
      const eventTemplate = {
        kind: 4,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', peerPubKey]],
        content: encryptedMsg
      }
      console.log(`eventTemplate: ${JSON.stringify(eventTemplate, null, 2)}`)

      // Sign the post
      const signedEvent = finalizeEvent(eventTemplate, privateKeyBin)
      console.log('signedEvent: ', signedEvent)

      // Publish the message via REST API (handles broadcasting to multiple relays)
      try {
        const result = await restClient.publishEvent(signedEvent)
        console.log('result: ', result)

        if (!result.accepted) {
          throw new Error(`Failed to publish: ${result.message || 'Unknown error'}`)
        }
      } catch (err) {
        console.warn(`Error publishing message: ${err}`)
        throw err
      }

      // Show the outbound message immediately (do not wait for SSE echo)
      if (onMsgRead) {
        onMsgRead({
          ...signedEvent,
          content: plaintext
        })
      }

      setMessage('')
      setOnFetch(false)
    } catch (error) {
      console.warn(error)
      setOnFetch(false)
    }
  }

  // Post on nostr network
  const handleSubmitPublic = async (e) => {
    e.preventDefault()
    try {
      setOnFetch(true)

      const { nostrKeyPair } = bchWalletState

      // Convert private key to binary
      const privateKeyBin = hexToBytes(nostrKeyPair.privHex)
      const plaintext = message

      // Generate a post.
      const eventTemplate = {
        kind: 42,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', selectedChannel, 'root']],
        content: plaintext
      }
      console.log(`eventTemplate: ${JSON.stringify(eventTemplate, null, 2)}`)

      // Sign the post
      const signedEvent = finalizeEvent(eventTemplate, privateKeyBin)
      console.log('signedEvent: ', signedEvent)

      // Publish the message via REST API (handles broadcasting to multiple relays)
      try {
        const result = await restClient.publishEvent(signedEvent)
        console.log('result: ', result)

        if (!result.accepted) {
          throw new Error(`Failed to publish: ${result.message || 'Unknown error'}`)
        }
      } catch (err) {
        console.warn(`Error publishing message: ${err}`)
        throw err
      }

      // Show the outbound message immediately
      if (onMsgRead) {
        onMsgRead(signedEvent)
      }

      setMessage('')
      setOnFetch(false)
    } catch (error) {
      console.warn(error)
      setOnFetch(false)
    }
  }

  const onChange = (e) => {
    setMessage(e.target.value)
  }
  return (
    <div className='p-3' style={{ backgroundColor: '#ffffff' }}>
      <Form onSubmit={isDm ? handleSubmitPrivate : handleSubmitPublic}>
        <InputGroup>
          <Form.Control
            as='textarea'
            rows={3}
            placeholder='Type a message...'
            className='border-1 bg-transparent text-dark'
            style={{
              backgroundColor: '#f8f9fa',
              border: '4px solid rgb(235, 232, 232)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              resize: 'none',
              minHeight: '60px',
              maxHeight: '120px'
            }}
            value={message}
            onChange={onChange}
            disabled={onFetch}
          />

          <Button
            type='submit'
            variant='link'
            className='text-dark border-0 bg-transparent ms-2'
            style={{
              color: '#6c757d',
              transition: 'color 0.2s ease',
              alignSelf: 'flex-end',
              marginBottom: '8px'
            }}
            title='Send message'
            disabled={onFetch}

          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </Button>
        </InputGroup>
      </Form>
    </div>
  )
}

export default MessageInput
