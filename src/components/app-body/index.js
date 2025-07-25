/*
  This Body component is a container for all the different Views of the app.
  Views are equivalent to 'pages' in a multi-page app. Views are hidden or
  displayed to simulate the use of pages in an SPA.
  The Body app contains all the Views and chooses which to show, based on
  the state of the Menu component.
*/

// Global npm libraries
import React from 'react'
import { Route, Routes } from 'react-router-dom'

// Local libraries
import GetBalance from './balance'
import Wallet from './bch-wallet'
import Placeholder2 from './placeholder2'
import Placeholder3 from './placeholder3'
// import ServerSelectView from './servers/select-server-view'
// import SelectServerButton from './servers/select-server-button'
import NftsForSale from './nfts-for-sale'
import BchSend from './bch-send'
import SlpTokens from './slp-tokens'
import SweepWif from './sweep/index.js'
import SignMessage from './sign/index.js'
import ServerSelectView from './configuration/select-server-view'
import NostrPost from './nostr/nostr-post/index.js'
import Profile from './nostr/profile/index.js'
import Feeds from './nostr/feeds/index.js'
import ContentCreators from './nostr/content-creators/index.js'
import UserDataReview from './user-data-review'
import Offers from './offers'
function AppBody (props) {
  // Dependency injection through props
  const appData = props.appData

  return (
    <>
      <Routes>
        <Route path='/' element={<NftsForSale appData={appData} />} />
        <Route path='/balance' element={<GetBalance wallet={appData.wallet} />} />
        <Route path='/bch' element={<BchSend appData={appData} />} />
        <Route path='/wallet' element={<Wallet appData={appData} />} />
        <Route path='/nfts-for-sale' element={<NftsForSale appData={appData} />} />
        <Route path='/slp-tokens' element={<SlpTokens appData={appData} />} />
        <Route path='/placeholder2' element={<Placeholder2 />} />
        <Route path='/placeholder3' element={<Placeholder3 />} />
        <Route path='/servers' element={<ServerSelectView appData={appData} />} />
        <Route path='/sweep' element={<SweepWif appData={appData} />} />
        <Route path='/sign' element={<SignMessage appData={appData} />} />
        <Route path='/configuration' element={<ServerSelectView appData={appData} />} />
        <Route path='/nostr-post' element={<NostrPost appData={appData} />} />
        <Route path='/profile/:npub' element={<Profile appData={appData} />} />
        <Route path='/feeds' element={<Feeds appData={appData} />} />
        <Route path='/content-creators' element={<ContentCreators appData={appData} />} />
        <Route path='/user-data/:tokenId' element={<UserDataReview appData={appData} />} />
        <Route path='/offers' element={<Offers appData={appData} />} />
      </Routes>
      {/** Show in all paths except the servers view */}
      {/* {appData.currentPath !== '/servers' && <SelectServerButton linkTo='/servers' appData={appData} />} */}
    </>
  )
}

export default AppBody
