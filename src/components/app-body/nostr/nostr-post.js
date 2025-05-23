/*
Component for posting nostr information.
*/

// Global npm libraries
import React, { useState } from 'react'
import { Container, Form, Button, Spinner } from 'react-bootstrap'
import Accordion from 'react-bootstrap/Accordion'
import { finalizeEvent } from 'nostr-tools/pure'
import { Relay } from 'nostr-tools/relay'
import { hexToBytes } from '@noble/hashes/utils' // already an installed dependency

function NostrPost (props) {
  const [accordionKey, setAccordionKey] = useState('1')
  const [onFetch, setOnFetch] = useState(false)
  const { bchWalletState } = props.appData
  const [formData, setFormData] = useState({
    name: '',
    about: ''
  })

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })

    setSuccessMsg('')
    setErrorMsg('')
  }
  // Post on nostr network
  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      setErrorMsg('')
      setSuccessMsg('')
      setOnFetch(true)

      const { nostrKeyPair } = bchWalletState

      // Convert private key to binary
      const privateKeyBin = hexToBytes(nostrKeyPair.privHex)

      // Relay list
      const psf = 'wss://nostr-relay.psfoundation.info'

      const formDataString = JSON.stringify(formData)

      // Generate a post.
      const eventTemplate = {
        kind: 0,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: formDataString
      }
      console.log(`eventTemplate: ${JSON.stringify(eventTemplate, null, 2)}`)

      // Sign the post
      const signedEvent = finalizeEvent(eventTemplate, privateKeyBin)
      console.log('signedEvent: ', signedEvent)

      // Connect to a relay.
      const relay = await Relay.connect(psf)
      console.log(`connected to ${relay.url}`)

      // Publish the message to the relay.
      const result = await relay.publish(signedEvent)
      console.log('result: ', result)

      // Close the connection to the relay.
      relay.close()
      resetForm()
      setSuccessMsg('Post successfully published!')
      setOnFetch(false)
    } catch (error) {
      console.warn(error)
      setErrorMsg(error.message || 'An error occurred while posting')
      setOnFetch(false)
    }
  }

  const handleAccordionChange = (key) => {
    setAccordionKey(key)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      about: ''
    })
  }

  return (
    <>
      <Container>
        <Accordion activeKey={accordionKey} onSelect={handleAccordionChange}>
          <Accordion.Item eventKey='1'>
            <Accordion.Header>Post</Accordion.Header>
            <Accordion.Body>
              {errorMsg && (
                <div className='alert alert-danger' role='alert'>
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className='alert alert-success' role='alert'>
                  {successMsg}
                </div>
              )}
              <Form onSubmit={handleSubmit}>
                <Form.Group className='mb-3'>
                  <Form.Label>Name</Form.Label>
                  <Form.Control
                    type='text'
                    placeholder='Enter your name'
                    name='name'
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>

                <Form.Group className='mb-3'>
                  <Form.Label>About</Form.Label>
                  <Form.Control
                    as='textarea'
                    rows={3}
                    placeholder='Tell us about yourself'
                    name='about'
                    value={formData.about}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>

                <div className='d-flex justify-content-center'>
                  {!onFetch && (
                    <Button variant='primary' type='submit' disabled={onFetch}>
                      Post
                    </Button>
                  )}
                  {onFetch && <Spinner animation='border' variant='primary' />}
                </div>

              </Form>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Container>
    </>
  )
}

export default NostrPost
