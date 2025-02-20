/*
  This Card component summarizes an SLP token.
*/

// Global npm libraries
import React from 'react'
import { Container, Row, Col, Card } from 'react-bootstrap'
// import BuyNftButton from './buy-button'
import InfoButton from './info-button'
// import FlagButton from './flag-button'

// Local libraries
// import InfoButton from './info-button'
// import SendTokenButton from './send-token-button'
// import SellButton from './sell-button'

function TokenCard (props) {
  let imageLink = ''
  if (props.token.mutableData) {
    imageLink = props.token.mutableData.tokenIcon

    if (props.token.mutableData.fullSizedUrl && props.token.mutableData.fullSizedUrl.includes('http')) {
      imageLink = props.token.mutableData.fullSizedUrl
    }
  }

  console.log('TokenCard props.token: ', props.token)

  return (
    <>
      <Col xs={12} sm={6} lg={4} style={{ padding: '25px' }}>
        <Card>
          <Card.Body style={{ textAlign: 'center' }}>
            <a href={imageLink} target='_blank' rel='noreferrer'>
              {props.token.icon}
            </a>
            <Card.Title style={{ textAlign: 'center' }}>
              <h4>{props.token.ticker}</h4>
            </Card.Title>

            <Container>
              <Row>
                <Col>
                  {props.token.tokenData ? props.token.tokenData.tokenStats.name : null}
                </Col>
              </Row>
              <br />

              <Row>
                <Col>Price:</Col>
                <Col>{props.token.usdPrice}</Col>
              </Row>
              <br />

              <Row>
                <Col>
                  <InfoButton token={props.token} />
                </Col>

                <Col></Col>

                <Col></Col>
              </Row>

            </Container>
          </Card.Body>
        </Card>
      </Col>
    </>
  )
}

{/* <Col>
                  <InfoButton token={props.token} />
                </Col>

                <Col>
                  <FlagButton appData={props.appData} offer={props.token} />
                </Col>

                <Col>
                  <BuyNftButton appData={props.appData} offer={props.token} />
                </Col> */}

export default TokenCard
