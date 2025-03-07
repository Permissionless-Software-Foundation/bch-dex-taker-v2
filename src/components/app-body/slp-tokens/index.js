/*
  This is the 'Token View'. It displays the SLP tokens in the wallet.
*/

// Global npm libraries
import React, { useState, useEffect, useCallback } from 'react'
import { Container, Row, Col, Spinner } from 'react-bootstrap'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleQuestion } from '@fortawesome/free-solid-svg-icons'

// Local libraries
import TokenCard from './token-card'
import RefreshTokenBalance from './refresh-tokens'

const SlpTokens = (props) => {
  const [appData, setAppData] = useState(props.appData)
  const [iconsAreLoaded, setIconsAreLoaded] = useState(false)
  const [tokens, setTokens] = useState([])

  const refreshTokenButtonRef = React.useRef()

  // Update the tokens state when the appData changes
  useEffect(() => {
    setTokens(appData.bchWalletState.slpTokens)
  }, [appData])

  // This function is triggered when the token balance needs to be refreshed
  // from the blockchain.
  // This needs to happen after sending a token, to reflect the changed balance
  // within the wallet app.
  // This function triggers the on-click function within the refresh-tokens.js button.
  const refreshTokens = async () => {
    const newAppData = await refreshTokenButtonRef.current.handleRefreshTokenBalance()
    setAppData(newAppData)
  }

  // Get Cid from url
  const parseCid = (url) => {
    // get the cid from the url format 'ipfs://bafybeicem27xbzs65uvbcgykcmscsgln3lmhbfrcoec3gdttkdgtxv5acq
    if (url && url.includes('ipfs://')) {
      const cid = url.split('ipfs://')[1]
      return cid
    }
    return url
  }

  // Fetch mutable data if it exist and get the token icon url
  const fetchTokenIcon = useCallback(async (token) => {
    try {
      // Get the token data
      const tokenData = await appData.wallet.getTokenData(token.tokenId)
      if (!tokenData.mutableData) return false // Return false if no mutable data
      // Get the token icon from the mutable data
      const cid = parseCid(tokenData.mutableData)
      console.log('mutable data cid', cid)

      const { json } = await appData.wallet.cid2json({ cid })

      if (!json) return false

      const iconUrl = json.tokenIcon
      // Return icon url
      return iconUrl
    } catch (error) {
      return false
    }
  }, [appData])

  //  This function loads the token icons from the ipfs gateways.
  const lazyLoadTokenIcons = useCallback(async () => {
    try {
      setIconsAreLoaded(false)

      const tokens = appData.bchWalletState.slpTokens

      setTokens(tokens) // update token state

      // map each token and fetch the icon url
      for (let i = 0; i < tokens.length; i++) {
        const thisToken = tokens[i]

        // Incon does not  need to be downloaded, so continue with the next one
        if (thisToken.iconAlreadyDownloaded) continue

        // Try to get token icon url from mutable data.
        const iconUrl = await fetchTokenIcon(thisToken)
        console.log('iconUrl', iconUrl)
        if (iconUrl) {
          // Set the icon url to the token , this can be used to display the icon in the token card component.
          thisToken.icon = iconUrl
        }

        // Mark token to prevent fetch token icon again.
        thisToken.iconAlreadyDownloaded = true
      }

      appData.updateBchWalletState({ walletObj: { slpTokens: tokens }, appData })
      setIconsAreLoaded(true)
    } catch (error) {
      setIconsAreLoaded(true)
    }
  }, [appData, fetchTokenIcon])

  // Start to load the token icons when the component is mounted
  useEffect(() => {
    lazyLoadTokenIcons()
  }, [lazyLoadTokenIcons])

  // Generate the token cards for each token in the wallet.
  const generateCards = () => {
    const tokens = appData.bchWalletState.slpTokens
    return tokens.map(thisToken => (
      <TokenCard
        appData={appData}
        token={thisToken}
        key={`${thisToken.tokenId}`}
        refreshTokens={refreshTokens}
      />
    ))
  }

  return (
    <>
      <Container>
        <Row>
          <Col xs={6}>
            <RefreshTokenBalance
              appData={appData}
              ref={refreshTokenButtonRef}
              lazyLoadTokenIcons={lazyLoadTokenIcons}
            />
          </Col>
          <Col xs={6} style={{ textAlign: 'right' }}>
            <a href='https://youtu.be/f1no5-QHTr4' target='_blank' rel='noreferrer'>
              <FontAwesomeIcon icon={faCircleQuestion} size='lg' />
            </a>
          </Col>
        </Row>
        <Row>
          <Col xs={12} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {
              !iconsAreLoaded && (
                <div style={{ borderRadius: '10px', backgroundColor: '#f0f0f0', padding: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: 'fit-content' }}>
                  <span style={{ marginRight: '10px' }}>Loading Token Icons </span>
                  <Spinner animation='border' />
                </div>
              )
            }

          </Col>
        </Row>
        <br />

        <Row>
          {generateCards()}
        </Row>
        {/** Display a message if no tokens are found */}
        {tokens.length === 0 && (
          <Row className='text-center'>
            <span> No tokens found in wallet </span>
          </Row>
        )}

      </Container>
    </>
  )
}

export default SlpTokens
