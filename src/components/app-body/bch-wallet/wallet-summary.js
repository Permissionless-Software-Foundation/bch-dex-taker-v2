/*
  This component displays a summary of the wallet.
*/

// Global npm libraries
import React, { useCallback, useEffect, useState } from 'react'
import { Container, Row, Col, Card } from 'react-bootstrap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWallet, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'
// import { Clipboard } from '@capacitor/clipboard'

// Local libraries
import './wallet-summary.css'
import CopyOnClick from './copy-on-click'
import { getPublicKey } from 'nostr-tools/pure'
import { base58_to_binary as base58ToBinary } from 'base58-js'
import { bytesToHex } from '@noble/hashes/utils' // already an installed dependency

function WalletSummary (props) {
  // Props
  const appData = props.appData
  const bchWalletState = appData.bchWalletState

  console.log('wallet summary state: ', bchWalletState)

  // State
  const [blurredMnemonic, setBlurredMnemonic] = useState(true)
  const [blurredPrivateKey, setBlurredPrivateKey] = useState(true)
  const [blurredNostrPrivKey, setBlurredNostrPrivKey] = useState(true)

  const [nostrKeyPair, setNostrKeyPair] = useState({
    privHex: '',
    pubHex: ''
  })

  // Encapsulate component state into an object that can be passed to child functions
  const walletSummaryData = {
    blurredMnemonic,
    setBlurredMnemonic,
    blurredPrivateKey,
    setBlurredPrivateKey
  }

  // Eye icon state
  const eyeIcon = {
    mnemonic: blurredMnemonic ? faEyeSlash : faEye,
    privateKey: blurredPrivateKey ? faEyeSlash : faEye
  }

  // Toggle the state of blurring for the mnemonic
  const toggleMnemonicBlur = (inObj = {}) => {
    try {
      const { walletSummaryData } = inObj

      // toggle the state of blurring
      const blurredState = walletSummaryData.blurredMnemonic
      walletSummaryData.setBlurredMnemonic(!blurredState)
    } catch (error) {
      console.error('Error toggling mnemonic blur: ', error)
    }
  }

  // Toggle the state of blurring for the private key
  const togglePrivateKeyBlur = (inObj = {}) => {
    try {
      const { walletSummaryData } = inObj

      // toggle the state of blurring
      const blurredState = walletSummaryData.blurredPrivateKey
      walletSummaryData.setBlurredPrivateKey(!blurredState)
    } catch (error) {
      console.error('Error toggling private key blur: ', error)
    }
  }

  // Toggle the state of blurring for the private key
  const toggleNostrPrivateKeyBlur = (inObj = {}) => {
    try {
      setBlurredNostrPrivKey(!blurredNostrPrivKey)
    } catch (error) {
      console.error('Error toggling private key blur: ', error)
    }
  }

  const nostrKeyPairFromWIF = useCallback((WIF) => {
    if (!WIF) return

    // Extract the privaty key from the WIF, using this guide:
    // https://learnmeabitcoin.com/technical/keys/private-key/wif/
    const wifBuf = base58ToBinary(WIF)
    const privBuf = wifBuf.slice(1, 33)
    // console.log('privBuf: ', privBuf)

    const privHex = bytesToHex(privBuf)
    console.log('BCH & Nostr private key (HEX format): ', privHex)

    const pubHex = getPublicKey(privBuf)
    console.log('nostrPubKey: ', pubHex)

    return {
      privHex,
      pubHex
    }
  }, [])

  useEffect(() => {
    setNostrKeyPair(nostrKeyPairFromWIF(bchWalletState.privateKey))
  }, [nostrKeyPairFromWIF, bchWalletState])
  return (
    <>
      <Container>
        <Row>
          <Col>
            <Card>
              <Card.Body>
                <Card.Title style={{ textAlign: 'center' }}>
                  <h2>
                    <FontAwesomeIcon icon={faWallet} />{' '}
                    <span>My Wallet</span>
                  </h2>
                </Card.Title>
                <Container>
                  <Row style={{ padding: '25px' }}>
                    <Col xs={12} sm={10} lg={8} style={{ padding: '10px' }}>
                      <b>Mnemonic:</b> <span className={blurredMnemonic ? 'blurred' : null}>{bchWalletState.mnemonic}</span>
                    </Col>
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }}>
                      <FontAwesomeIcon
                        style={{ cursor: 'pointer' }}
                        icon={eyeIcon.mnemonic}
                        size='lg'
                        onClick={() => toggleMnemonicBlur({ walletSummaryData })}
                      />
                    </Col>
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }}>
                      <CopyOnClick walletProp='mnemonic' appData={appData} value={bchWalletState.mnemonic} />
                    </Col>
                  </Row>

                  <Row style={{ padding: '25px', backgroundColor: '#eee' }}>
                    <Col xs={12} sm={10} lg={8} style={{ padding: '10px' }}>
                      <b>Private Key:</b> <span className={blurredPrivateKey ? 'blurred' : null}>{bchWalletState.privateKey}</span>
                    </Col>
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }}>
                      <FontAwesomeIcon
                        style={{ cursor: 'pointer' }}
                        icon={eyeIcon.privateKey}
                        size='lg'
                        onClick={() => togglePrivateKeyBlur({ walletSummaryData })}
                      />
                    </Col>
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }}>
                      <CopyOnClick walletProp='privateKey' appData={appData} value={bchWalletState.privateKey} />
                    </Col>
                  </Row>

                  <Row style={{ padding: '25px' }}>
                    <Col xs={12} sm={10} lg={8} style={{ padding: '10px' }}>
                      <b>Cash Address:</b> {bchWalletState.cashAddress}
                    </Col>
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }} />
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }}>
                      <CopyOnClick walletProp='cashAddress' appData={appData} value={bchWalletState.cashAddress} />
                    </Col>
                  </Row>

                  <Row style={{ padding: '25px', backgroundColor: '#eee' }}>
                    <Col xs={12} sm={10} lg={8} style={{ padding: '10px' }}>
                      <b>SLP Address:</b> {bchWalletState.slpAddress}
                    </Col>
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }} />
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }}>
                      <CopyOnClick walletProp='slpAddress' appData={appData} value={bchWalletState.slpAddress} />
                    </Col>
                  </Row>

                  <Row style={{ padding: '25px' }}>
                    <Col xs={12} sm={10} lg={8} style={{ padding: '10px' }}>
                      <b>Legacy Address:</b> {bchWalletState.legacyAddress}
                    </Col>
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }} />
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }}>
                      <CopyOnClick walletProp='legacyAddress' appData={appData} value={bchWalletState.legacyAddress} />
                    </Col>
                  </Row>

                  <Row style={{ padding: '25px', backgroundColor: '#eee' }}>
                    <Col xs={10} sm={10} lg={8} style={{ padding: '10px' }}>
                      <b>HD Path:</b> {bchWalletState.hdPath}
                    </Col>
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }} />
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }}>
                      <CopyOnClick walletProp='hdPath' appData={appData} value={bchWalletState.hdPath} />
                    </Col>
                  </Row>
                  <Row style={{ padding: '25px', backgroundColor: '#eee' }}>
                    <Col xs={10} sm={10} lg={8} style={{ padding: '10px' }}>
                      <b>Nostr Priv Key:</b> <span className={blurredNostrPrivKey ? 'blurred' : null}>{nostrKeyPair.privHex}</span>
                    </Col>
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }}>
                      <FontAwesomeIcon
                        style={{ cursor: 'pointer' }}
                        icon={eyeIcon.privateKey}
                        size='lg'
                        onClick={() => toggleNostrPrivateKeyBlur(nostrKeyPair.privHex)}
                      />
                    </Col>
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }}>
                      <CopyOnClick appData={appData} value={nostrKeyPair.privHex} />
                    </Col>
                  </Row>
                  <Row style={{ padding: '25px', backgroundColor: '#eee' }}>
                    <Col xs={10} sm={10} lg={8} style={{ padding: '10px' }}>
                      <b>Nostr Pub Key:</b> {nostrKeyPair.pubHex}
                    </Col>
                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }} />

                    <Col xs={6} sm={1} lg={2} style={{ textAlign: 'center' }}>
                      <CopyOnClick appData={appData} value={nostrKeyPair.pubHex} />
                    </Col>
                  </Row>
                </Container>
              </Card.Body>
            </Card>

          </Col>
        </Row>
      </Container>
    </>
  )
}

export default WalletSummary
