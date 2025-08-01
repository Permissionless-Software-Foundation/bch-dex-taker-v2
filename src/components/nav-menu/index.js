/*
  This component controlls the navigation menu.

  Inspired from this example:
  https://codesandbox.io/s/react-bootstrap-hamburger-menu-example-rnud4?from-embed
*/

// Global npm libraries
import React, { useState } from 'react'
import { Nav, Navbar, Image } from 'react-bootstrap' // Used for Navbar Style and Layouts .
import { NavLink } from 'react-router-dom' // Used to navigate between routes

// Assets
import Logo from './psf-logo.png'

function NavMenu (props) {
  // Get the current path
  const { currentPath, bchWalletState, isSingleView } = props.appData
  // Navbar state
  const [expanded, setExpanded] = useState(false)

  // Handle click event
  const handleClickEvent = () => {
    // Collapse the navbar
    setExpanded(false)
  }
  const goToHome = () => {
    if (isSingleView) {
      window.location.href = '/'
    }
  }

  return (
    <>
      <Navbar expanded={expanded} onToggle={setExpanded} expand='xxxl' bg='dark' variant='dark' style={{ paddingRight: '20px' }}>
        <Navbar.Brand href='#home' style={{ paddingLeft: '20px' }} onClick={goToHome}>
          <Image src={Logo} thumbnail width='50' />{' '}
          DEX
        </Navbar.Brand>

        {!isSingleView && <Navbar.Toggle aria-controls='responsive-navbar-nav' />}
        {!isSingleView && (
          <Navbar.Collapse id='responsive-navbar-nav'>
            <Nav className='mr-auto'>
              <NavLink
                className={(currentPath === '/nfts-for-sale' || currentPath === '/') ? 'nav-link-active' : 'nav-link-inactive'}
                to='/nfts-for-sale'
                onClick={handleClickEvent}
              >
                NFTs
              </NavLink>

              <NavLink
                className={currentPath === '/offers' ? 'nav-link-active' : 'nav-link-inactive'}
                to='/offers'
                onClick={handleClickEvent}
              >
                Fungible Tokens
              </NavLink>

              <hr />

              <NavLink
                className={currentPath === '/global-feed' ? 'nav-link-active' : 'nav-link-inactive'}
                to='/feeds'
                onClick={handleClickEvent}
              >
                Feeds
              </NavLink>
              <NavLink
                className={currentPath === '/nostr-post' ? 'nav-link-active' : 'nav-link-inactive'}
                to='/nostr-post'
                onClick={handleClickEvent}
              >
                Nostr Post
              </NavLink>
              <NavLink
                className={currentPath === '/profile' ? 'nav-link-active' : 'nav-link-inactive'}
                to={`/profile/${bchWalletState?.nostrKeyPair?.npub}`}
                onClick={handleClickEvent}
              >
                Nostr Profile
              </NavLink>
              <NavLink
                className={currentPath === '/content-creators' ? 'nav-link-active' : 'nav-link-inactive'}
                to='/content-creators'
                onClick={handleClickEvent}
              >
                Content Creators
              </NavLink>

              <hr />

              <NavLink
                className={(currentPath === '/bch') ? 'nav-link-active' : 'nav-link-inactive'}
                to='/bch'
                onClick={handleClickEvent}
              >
                BCH
              </NavLink>

              <NavLink
                className={currentPath === '/slp-tokens' ? 'nav-link-active' : 'nav-link-inactive'}
                to='/slp-tokens'
                onClick={handleClickEvent}
              >
                Tokens
              </NavLink>

              <NavLink
                className={currentPath === '/wallet' ? 'nav-link-active' : 'nav-link-inactive'}
                to='/wallet'
                onClick={handleClickEvent}
              >
                Wallet
              </NavLink>

              <NavLink
                className={(currentPath === '/balance') ? 'nav-link-active' : 'nav-link-inactive'}
                to='/balance'
                onClick={handleClickEvent}
              >
                Check Balance
              </NavLink>

              <NavLink
                className={(currentPath === '/sweep') ? 'nav-link-active' : 'nav-link-inactive'}
                to='/sweep'
                onClick={handleClickEvent}
              >
                Sweep
              </NavLink>
              <NavLink
                className={(currentPath === '/sign') ? 'nav-link-active' : 'nav-link-inactive'}
                to='/sign'
                onClick={handleClickEvent}
              >
                Sign
              </NavLink>
              <NavLink
                className={currentPath === '/configuration' ? 'nav-link-active' : 'nav-link-inactive'}
                to='/configuration'
                onClick={handleClickEvent}
              >
                Configuration
              </NavLink>

            </Nav>
          </Navbar.Collapse>
        )}
      </Navbar>
    </>
  )
}

export default NavMenu
