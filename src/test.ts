// src/index.ts
import dotenv from 'dotenv'
import express, { Express, Request, Response } from 'express'

import { firestore } from 'firebase-admin'
import { Message } from './chat.model'
import { BOT_TOKENS, sendTelegramMessage } from './utils'

const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const serviceAccount = require('D:/Development/servicekeys/zale-wiki-6af17806a991.json')
const data = require('D:/Development/Backup/RequestResponses/chatdata_2024-08-18_20-43.json')

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
var http = require('https')
/* Start the Express app and listen
 for incoming requests on the specified port */
app.listen(port, async () => {
  const kljipsi = data.messages.filter((message: Message) => {
    return message.sender_id === 14 && message.message.includes('embed')
  })

  kljipsi
    .map(
      (m: Message) =>
        `${m.message.split('src')[1].split('"')[1].split('?')[0]} - ${
          m.message.split('title')[1].split('"')[1]
        }`
    )
    .forEach((element: any, index: number) => {
      if (index > 21) {
        // console.log(`${index}. ${element} - Delayed: ${index * 1000}`);
        setTimeout(() => {
          console.log(
            `Sending: ${index}. ${element.replace('embed/', 'watch?v=')}`
          )
          sendTelegramMessage(
            `Novi kljipsi: ${element
              .split(' - ')[0]
              .replace('embed/', 'watch?v=')}`,
            BOT_TOKENS.ZALET_KLJIPSI.token,
            BOT_TOKENS.ZALET_KLJIPSI.chat_id
          )
        }, (index - 18) * 3000)
      }
    })
  // .join('\n\n')

  // console.log(res)
})
