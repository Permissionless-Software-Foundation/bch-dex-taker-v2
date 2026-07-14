/*
  Global configuration settings for this app.
*/

const config = {
  // Default IPFS CID for the app. This will be overwritten by dynamic lookup.
  ipfsCid: 'bafybeibya4cwro6rgqfaazqxckcchy6qo5sz2aqc4dx7ptcvpns5peqcz4',

  // BCH address used to point to the latest version of the IPFS CID.
  appBchAddr: 'bitcoincash:qztv87ppjh82v527jq2drp4u8rzzn63r5cmhth2zzm',

  // Backup Info that goes into the Footer.
  ghPagesUrl: 'https://permissionless-software-foundation.github.io/react-bootstrap-web3-spa/',
  ghRepo: 'https://github.com/Permissionless-Software-Foundation/bch-dex-taker-v2',
  radicleUrl: 'https://app.radicle.network/seeds/maple.radicle.garden/rad:git:hnrkd5cjwwb5tzx37hq9uqm5ubon7ee468xcy/remotes/hyyycncbn9qzqmobnhjq9rry6t4mbjiadzjoyhaknzxjcz3cxkpfpc',

  // dexServer: 'https://dex-api.fullstackcash.net',
  // dexServer: 'http://localhost:5700',
  dexServer: process.env.REACT_APP_DEX_SERVER || 'https://dex-api.fullstackcash.net',

  nostrTopic: 'bch-dex-test-topic-02',

  // REST API endpoint for Nostr relay interactions (primary interface)
  nostrRestApiUrl: 'https://nostr-relay-api.fullstackcash.net',
  // nostrRestApiUrl: 'http://localhost:5942',

  // Legacy relay URLs kept for reference (may be used in tags, but actual connections use REST API)
  nostrRelay: 'wss://nostr.fullstackcash.net',
  nostrRelays: [
    'wss://nostr.fullstackcash.net',
    'wss://nos.lol',
    'wss://relay.damus.io'
  ],
  chatsId: [
    '32b0ebc01c984008977fbe476e064946990df75525331b24b37bbba5e89f4039'
  ]

}

export default config
