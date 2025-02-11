/*
  Shows NFTs for sale on the DEX.
*/

// Global npm libraries
import React, { useState, useEffect } from 'react'
import { Container, Row, Card, Col, Button, Spinner } from 'react-bootstrap'
import axios from 'axios'
import Jdenticon from '@chris.troutner/react-jdenticon'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRedo } from '@fortawesome/free-solid-svg-icons'
// import BchDexLib from 'bch-dex-lib'
// import RetryQueue from '@chris.troutner/retry-queue'

// Local libraries
import config from '../../../config'
import TokenCard from './token-card'
// Global variables and constants
const SERVER = config.dexServer

function NftsForSale (props) {
  // Dependency injection through props
  const appData = props.appData
  console.log('NftsForSale() appData: ', appData)

  // State
  const [offers, setOffers] = useState([])

  async function getNftOffers(page = 0) {
    try {
      const options = {
        method: 'GET',
        url: `${SERVER}/offer/list/nft/${page}`,
        data: {}
      }
      const result = await axios.request(options)
      console.log('result.data: ', result.data)

      const rawOffers = result.data

      const bchjs = appData.wallet.bchjs
      const wallet = appData.wallet

      // Instantiate the BchDexLib object.
      // const dexLib = new BchDexLib({bchWallet: wallet, p2wdbRead: {}, p2wdbWrite: {}})

      const offerDataCallback = (offer) => {
        console.log('offerDataCallback() offer: ', offer)
      }

      // Add a default icon.
      for (let i = 0; i < rawOffers.length; i++) {
        const thisOffer = rawOffers[i]

        thisOffer.icon = (<Jdenticon size='100' value={thisOffer.tokenId} />)
        thisOffer.iconDownloaded = false

        // Convert sats to BCH, and then calculate cost in USD.
        const rateInSats = parseInt(thisOffer.rateInBaseUnit)
        // console.log('rateInSats: ', rateInSats)
        const bchCost = bchjs.BitcoinCash.toBitcoinCash(rateInSats)
        // console.log('bchCost: ', bchCost)
        // console.log('bchUsdPrice: ', this.state.appData.bchWalletState.bchUsdPrice)
        const usdPrice = bchCost * appData.bchWalletState.bchUsdPrice * thisOffer.numTokens
        // usdPrice = bchjs.Util.floor2(usdPrice)
        // console.log(`usdPrice: ${usdPrice}`)
        const priceStr = `$${usdPrice.toFixed(3)}`
        thisOffer.usdPrice = priceStr

        // Download token data
        // await dexLib.tokenData.getTokenData(thisOffer, offerDataCallback)
        const tokenData = await wallet.getTokenData(thisOffer.tokenId)
        console.log('complete tokenData: ', tokenData)

        // const mutableCid = tokenData.mutableData.slice(7)
        // const url1 = `https://free-bch.fullstack.cash/ipfs/file-info/${mutableCid}`
        // console.log('url1: ', url1)
        // const resp1 = await axios.get(url1)
        // console.log('resp1.data: ', resp1.data)

        try {
          const mutableCid = tokenData.mutableData.slice(7)
          console.log(`mutable CID for token ${thisOffer.tokenId}: ${mutableCid}`)
          let mutableData = await wallet.cid2json({ cid: mutableCid })
          console.log('mutableData: ', mutableData)
          mutableData = mutableData.json

        } catch(err) {
          console.error(`Could not download mutable data for token ${thisOffer.tokenId}: ${err.message}`)
        }
      }

      return rawOffers
    } catch(err) {
      console.error('NftsForSale() getNftOffers() error: ', err)
      return []
    }
  }

  async function handleOffers() {
    let offers = await getNftOffers()
    console.log('offers: ', offers)

    return offers
  }

  async function handleStartProcessingTokens() {
    return await handleOffers()
  }

  // This is an async startup function that is called by the useEffect hook.
  const asyncStartup = async () => {
    try {
      const offers = await handleStartProcessingTokens()
      setOffers(offers)
    } catch (error) {
      console.error('NftsForSale() asyncStartup() error: ', error)
    }
  }

  // Load NFT data when the page loads from the server or from the cache.
  useEffect(() => {
    asyncStartup()
  }, [])

  // This function generates a Token Card for each token in the wallet.
  function generateCards () {
    // console.log('generateCards() offerData: ', offerData)

    const tokens = offers

    const tokenCards = []

    for (let i = 0; i < tokens.length; i++) {
      const thisToken = tokens[i]
      // console.log(`thisToken: ${JSON.stringify(thisToken, null, 2)}`)

      const thisTokenCard = (
        <TokenCard
          appData={appData}
          token={thisToken}
          key={`${thisToken.tokenId}`}
        />
      )
      tokenCards.push(thisTokenCard)
    }

    return tokenCards
  }

  return (
    <Container>
      <Row>
        <Col>
          <h1>NFTs for Sale</h1>
        </Col>
      </Row>

      <Row>
        <Col xs={6}>
          <Button variant='success' >
            <FontAwesomeIcon icon={faRedo} size='lg' /> Refresh
          </Button>
        </Col>
      </Row>

      <Row>
        {generateCards()}
      </Row>
    </Container>
  )
}

export default NftsForSale
