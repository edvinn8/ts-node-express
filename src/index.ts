// src/index.ts
import dotenv from 'dotenv'
import express, { Express, Request, Response } from 'express'

import bodyParser from 'body-parser'
import fs from 'fs'
import * as shell from 'shelljs'

import { Firestore } from '@google-cloud/firestore'
import {
  Chat,
  ChatConfig,
  ChatUser,
  ManualTriggerEventType,
  Message
} from './chat.model'
import {
  addToCollection,
  generateFilenameWithDate,
  getDateTimeString,
  processManualTrigger,
  sendTelegramMessage
} from './utils'

const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const deepEqual = require('deep-equal')
const cloneDeep = require('clone-deep')
const folderPath = 'D:/Development/Backup/RequestResponses/' // './Responses/',
const serviceAccount = require('D:/Development/servicekeys/zale-wiki-6af17806a991.json')

// Variables
const timestamp = Date.now()

const MESSAGES = `https://zalet.zaleprodukcija.com/wp-json/better-messages/v1/checkNew?nocache=${timestamp}`
const MESSAGES_INTERVAL = 1000 * 15 // every 1 minute
const PARTICIPANTS = `https://zalet.zaleprodukcija.com/wp-json/better-messages/v1/lazyPool?nocache=${timestamp}`

let chatConfig: ChatConfig

let errorCount = 0
let telegramSent = false

const notifyAfterNMessages = [5, 10, 20, 50]
let newMessagesNotification = Array(4).fill(false)
let previousMessages: Message[] | undefined
let rawResponse: string

initializeApp({
  credential: cert(serviceAccount)
})

const db: Firestore = getFirestore()

dotenv.config()

const app: Express = express()
const port = process.env.PORT || 3000

// Create the folder path in case it doesn't exist
shell.mkdir('-p', folderPath)

// Change the limits according to your response size
app.use(bodyParser.json({ limit: '50mb' }))
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))

/* Define a route for the root path ("/")
 using the HTTP GET method */
app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server')
})

let init = true
let checkInProgress = false
let lastUpdate = Date.now()
/* Start the Express app and listen
 for incoming requests on the specified port */
app.listen(port, async () => {
  console.log(
    'ResponsesToFile App is listening now! Send them requests my way!'
  )
  console.log(`Data is being stored at location: ${folderPath}\n`)

  const lessThanAMinute = MESSAGES_INTERVAL < 60000
  const messageCheckOccurence = lessThanAMinute
    ? MESSAGES_INTERVAL / 1000
    : MESSAGES_INTERVAL / 1000 / 60
  console.log(
    `Messages will be checked every ${messageCheckOccurence} ${
      lessThanAMinute ? 'seconds' : 'minutes'
    }`
  )

  const chatDoc = await db.collection('config').doc('chatConfig')
  chatConfig = (await chatDoc.get()).data() as ChatConfig

  if (!!chatConfig) {
    console.log('\nConfig fetched successfully.')
    console.log(`User id: ${chatConfig.user_id}`)
    console.log(`Nonce: ${chatConfig.wpNonce}`)
    console.log(
      'Config date:',
      getDateTimeString(chatConfig.updatedAt.toDate())
    )
  }

  db.collection('manualTriggers').onSnapshot(async (doc) => {
    if (!init) {
      for (const change of doc.docChanges()) {
        if (change.type === 'added') {
          const data = change.doc.data()
          const eventType = change.doc.data()
            .eventType as ManualTriggerEventType
          await processManualTrigger(eventType, data, db)
        }
      }

      await getMessages()
    }

    init = false
  })

  // random number between 100 and 900
  const randomOffset = Math.floor(Math.random() * 800) + 100
  await getMessages()

  setInterval(async () => {
    await getMessages()
  }, MESSAGES_INTERVAL + randomOffset)
})

const pingZalet = async (url: string, users?: number[]) => {
  if (telegramSent) {
    console.log('Reloading chatConfig after error...')
    const chatDoc = await db.collection('config').doc('chatConfig')
    chatConfig = (await chatDoc.get()).data() as ChatConfig
  }

  console.log('lastUpdate: ', lastUpdate)

  let payload =
    url === PARTICIPANTS
      ? {
          users
        }
      : {
          lastUpdate: 17212174354361 - 1,
          visibleThreads: [],
          threadIds: [8]
        }
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'X-WP-Nonce': chatConfig.wpNonce,
      host: 'zalet.zaleprodukcija.com',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: chatConfig.wpCookie
    },
    body: JSON.stringify(payload)
  })

  if (!resp.ok) {
    return Promise.reject()
  }

  return resp.json()
}

const processChatData = async (responseJson: any) => {
  const chatDoc = await db.collection('zaletChat').doc('generalChat')
  const chat = (await chatDoc.get()).data()

  const doc = await db
    .collection('zaletChat/generalChat/messages')
    .orderBy('message_id', 'desc')
    .limit(1)
    .get()
  const lastSavedMessageId =
    doc.docs[0]?.data().message_id || chat?.lastMessageId || 1

  if (!lastSavedMessageId) {
    return Promise.resolve()
  }

  console.log('Last saved message id: ', lastSavedMessageId)

  const chatData = responseJson as Chat
  rawResponse = JSON.stringify(chatData)

  const allMessages = cloneDeep(chatData.messages) as Message[]

  const replies = allMessages.filter((m) => m.meta?.replyTo)
  replies.forEach((m) => {
    m.replyTo = allMessages.find((msg) => msg.message_id === m.meta.replyTo)
  })

  let participants: ChatUser[] = []

  let lastMessageId = 0

  // process messages
  for (let m of allMessages) {
    if (!m.message.includes('edo-processed') && m.meta.files?.length) {
      m.meta.files.forEach((file) => {
        m.message =
          (m.message.includes('BM-ONLY-FILES') ? '' : m.message) +
          `<br/> <a class="edo-processed" href="${file.url}" target="_blank"><img src="${file.url}" alt="${file.name}" /></a>`
      })
      m.hasFiles = true
    }

    lastMessageId = m.message_id
  }

  console.log('Message metadata processed.')

  const newMessages = [
    ...allMessages.filter((m) => m.message_id > lastSavedMessageId)
  ]
  const messagesToUpdate: Message[] = [...newMessages]

  let timePassedInMs
  const now = Date.now()

  if (!!previousMessages) {
    allMessages
      .filter((m) => m.message_id > lastMessageId - 100)
      .forEach((m, i) => {
        const prev = previousMessages!.find(
          (pm) => pm.message_id === m.message_id
        )
        if (!deepEqual(m, prev)) {
          messagesToUpdate.push(m)
        }
      })
  }

  timePassedInMs = Date.now() - now

  console.log(`Time passed: ${timePassedInMs}ms`)
  console.log(`Found ${newMessages.length} messages to insert.`)
  console.log(
    `Found ${messagesToUpdate.length - newMessages.length} messages to update.`
  )

  previousMessages = allMessages

  for (let m of messagesToUpdate) {
    const docRef = await db
      .collection('zaletChat/generalChat/messages')
      .where('message_id', '==', m.message_id)
      .get()

    if (docRef.docs.length > 0) {
      await docRef.docs[0].ref.set(m)
      console.log(
        `Updating message: Id: ${m.message_id}, message: ${m.message}`
      )
    } else {
      console.log(
        `Inserting message: Id: ${m.message_id}, message: ${m.message}`
      )
      await addToCollection(db, 'zaletChat/generalChat/messages', m)
    }
  }

  const allSenders = allMessages.map((m) => m.sender_id)
  const allReactionIds = allMessages
    .filter((m) => !Array.isArray(m.meta) && m.meta.reactions?.length)
    .map((m) => m.meta.reactions!.map((r) => r.users))
    .flat()
    .flat()
  const allSendersSet = new Set([...allSenders, ...allReactionIds])

  if (messagesToUpdate.length) {
    participants = await getParticipants(Array.from(allSendersSet))
  }

  lastMessageId = lastMessageId || lastSavedMessageId

  const unreadMessagesCount = lastMessageId - chat?.lastReadMessageId
  notifyForUnreadMessages(unreadMessagesCount)

  await db
    .collection('zaletChat')
    .doc('generalChat')
    .update({
      lastUpdate: getDateTimeString(),
      totalMessages: chatData.messages.length || 0,
      users: participants.length ? participants : chat?.users || [],
      participantsCount:
        chatData.threads[0]?.participantsCount || chat?.participantsCount || 0,
      lastMessageId
    })

  console.log('Messages successfully processed!')

  return Promise.resolve()
}

const getMessages = async () => {
  console.log(`\n`)

  if (checkInProgress) {
    console.log('Check already in progress')
    return Promise.resolve()
  }
  checkInProgress = true
  console.log(getDateTimeString())
  console.log('Checking for new messages')

  let responseJson

  try {
    let timePassedInMs
    const now = Date.now()
    responseJson = await pingZalet(MESSAGES)
    timePassedInMs = Date.now() - now
    console.log(`Time passed pingZalet: ${timePassedInMs}ms`)
    lastUpdate = responseJson.currentTime
    if (telegramSent) {
      sendTelegramMessage('Cookies updated, fetching messages again!')
    }
    telegramSent = false
    errorCount = 0
  } catch (e) {
    console.error('Error fetching messages')
    // notify telegram to update cookies
    errorCount++
    if (errorCount > 5 && !telegramSent) {
      sendTelegramMessage('Error fetching messages, check cookies ASAP!')
      errorCount = 0
      telegramSent = true
    }
    checkInProgress = false
    return Promise.resolve()
  }

  console.log('Fetched messages: ', responseJson.messages.length)

  await processChatData(responseJson)
  if (new Date().getMinutes() % 30 === 0) {
    const filename = generateFilenameWithDate('chatdata')
    console.log(`Saving response to file: ${filename}`)

    fs.writeFileSync(`${folderPath}${filename}`, JSON.stringify(rawResponse))
  }

  checkInProgress = false
  return Promise.resolve()
}

const getParticipants = async (participants: number[]): Promise<ChatUser[]> => {
  console.log(getDateTimeString())
  console.log('Checking for participants')

  let responseJson

  try {
    responseJson = await pingZalet(PARTICIPANTS, participants)
  } catch (e) {
    return Promise.resolve([])
  }
  console.log('Fetched users: ', responseJson.users.length)

  const isTenthMinute = new Date().getMinutes() % 10 === 0
  // await processUsers(responseJson)

  if (isTenthMinute && responseJson.users.length > 0) {
    const filename = generateFilenameWithDate('chatusers')

    fs.writeFileSync(`${folderPath}${filename}`, JSON.stringify(responseJson))
  }

  return Promise.resolve(responseJson.users)
}

function notifyForUnreadMessages(unreadMessagesCount: number) {
  console.log(`You have ${unreadMessagesCount} unread messages!`)

  let notificationIndex = -1

  for (let i = 0; i < notifyAfterNMessages.length; i++) {
    if (unreadMessagesCount >= notifyAfterNMessages[i]) {
      notificationIndex = i
    }
  }

  const shouldNotify = notificationIndex !== -1

  if (shouldNotify) {
    const message = `Check Zalet chat, you have ${unreadMessagesCount} unread messages!`
    if (!newMessagesNotification[notificationIndex]) {
      newMessagesNotification[notificationIndex] = true
      sendTelegramMessage(message)
    }
  } else {
    newMessagesNotification = Array(4).fill(false)
  }
}
