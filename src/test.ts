// src/index.ts
import dotenv from 'dotenv'
import express, { Express, Request, Response } from 'express'

import { firestore } from 'firebase-admin'
import { Message } from './chat.model'
import { BOT_TOKENS, sendTelegramMessage } from './utils'

const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const serviceAccount = require('D:/Development/servicekeys/zale-wiki-6af17806a991.json')

initializeApp({
  credential: cert(serviceAccount)
})

const db: firestore.Firestore = getFirestore()

dotenv.config()

const app: Express = express()
const port = process.env.PORT || 3001

/* Define a route for the root path ("/")
 using the HTTP GET method */
app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server')
})

const sendLastNMessages = 3

/* Start the Express app and listen
 for incoming requests on the specified port */
app.listen(port, async () => {
  const query = await db
    .collection('zaletChat/generalChat/messages')
    .where('isKljipsi', '==', true)
    .orderBy('message_id', 'desc')
    .limit(sendLastNMessages)
    .get()

  const messages = query.docs.map((d) => d.data() as Message).reverse()

  const kljipsi = messages
    .filter((message: Message) => {
      return message.sender_id === 14 && message.message.includes('embed')
    })
    .map(
      (m: Message) =>
        `${m.message
          .split('src')[1]
          .split('"')[1]
          .split('?')[0]
          .replace('embed/', 'watch?v=')} - ${
          m.message.split('title')[1].split('"')[1]
        }`
    )

  for (let index = 0; index < kljipsi.length; index++) {
    const element = kljipsi[index]
    setTimeout(() => {
      console.log(`Sending: ${index + 1}. ${element}`)
      console.log(`Novi kljipsi: ${element.split(' - ')[0]}`)
      // sendTelegramMessage(
      //   `Novi kljipsi: ${element.split(' - ')[0]}`,
      //   BOT_TOKENS.ZALET_KLJIPSI.token,
      //   BOT_TOKENS.ZALET_KLJIPSI.chat_id
      // )
    }, index * 3000)
  }
})
