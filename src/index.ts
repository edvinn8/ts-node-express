// src/index.ts
import dotenv from 'dotenv'
import express, { Express, Request, Response } from 'express'

import bodyParser from 'body-parser'
import fs from 'fs'
import * as shell from 'shelljs'

import { firestore } from 'firebase-admin'
import path from 'path'
import {
  Chat,
  ChatConfig,
  ChatUser,
  ChatUserConfig,
  Message,
  ReactionUpdate
} from './chat.model'
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const serviceAccount = require('D:/Development/servicekeys/zale-wiki-6af17806a991.json')
const deepEqual = require('deep-equal')
const cloneDeep = require('clone-deep')

// Variables
const timestamp = Date.now()
const MESSAGES = `https://zalet.zaleprodukcija.com/wp-json/better-messages/v1/checkNew?nocache=${timestamp}`
const MESSAGES_INTERVAL = 1000 * 15 // every 1 minute
const USERS = `https://zalet.zaleprodukcija.com/wp-json/better-messages/v1/thread/8?nocache=${timestamp}`
const PARTICIPANTS = `https://zalet.zaleprodukcija.com/wp-json/better-messages/v1/lazyPool?nocache=${timestamp}`
// const USERS_INTERVAL = 1000 * 60 * 5 // every 5 minutes

let chatConfig: ChatConfig

let errorCount = 0
let telegramSent = false
let eagerModeActive = false
let currentUser: ChatUserConfig | undefined
let previousMessages: Message[] = []

initializeApp({
  credential: cert(serviceAccount)
})

const db: firestore.Firestore = getFirestore()

dotenv.config()

const app: Express = express()
const port = process.env.PORT || 3000

const folderPath = 'D:/Development/Backup/RequestResponses/' // './Responses/',

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

  setTimeout(() => {
    init = false
  }, MESSAGES_INTERVAL)

  const chatDoc = await db.collection('config').doc('chatConfig')
  chatConfig = (await chatDoc.get()).data() as ChatConfig

  if (!!chatConfig) {
    console.log('\nConfig fetched successfully.')
    console.log(
      'Config date:',
      getDateTimeString(chatConfig.updatedAt.toDate())
    )
  }

  // random number between 100 and 900
  const randomOffset = Math.floor(Math.random() * 800) + 100
  await getMessages()

  setInterval(async () => {
    await getMessages()
  }, MESSAGES_INTERVAL + randomOffset)

  db.collection('manualTriggers').onSnapshot(async (doc) => {
    if (!init) {
      eagerModeActive = true
      console.log('Manual trigger received')

      setTimeout(async () => {
        // immediate check
        await getMessages()
      }, 1000)

      let counter = 0
      const checkInterval = setInterval(async () => {
        // check every 5 seconds for 50 seconds
        await getMessages()

        counter++
        if (counter > 10 || !eagerModeActive) {
          clearInterval(checkInterval)
        }
      }, 5000)
    }
  })
})

app.post('/test', async (req, res) => {
  console.log('Test request received')
  const fetchedResponse = await pingZalet(MESSAGES)
  console.log('fetched messages: ', fetchedResponse.messages.length)

  res.send(fetchedResponse)
})

const pingZalet = async (url: string, users?: number[]) => {
  if (telegramSent) {
    console.log('Reloading chatConfig after error...')
    const chatDoc = await db.collection('config').doc('chatConfig')
    chatConfig = (await chatDoc.get()).data() as ChatConfig
  }

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

const defaultFileExtension = 'json'
const DEFAULT_MODE = 'writeFile'

app.post('/write', async (req, res) => {
  const requestName = req.body.requestName
  console.log(`\n${getDateTimeString()}`)
  console.log(`Request received - ${requestName}`)
  let extension = req.body.fileExtension || defaultFileExtension,
    uniqueIdentifier = req.body.uniqueIdentifier
      ? typeof req.body.uniqueIdentifier === 'boolean'
        ? Date.now()
        : req.body.uniqueIdentifier
      : false,
    filename = `${requestName}${uniqueIdentifier || ''}`,
    filePath = `${path.join(folderPath, filename)}.${extension}`,
    options = req.body.options || undefined

  // console.log(`Data written to file: ${filePath}`)

  const responseJson = JSON.parse(req.body.responseData)

  // Write data to file
  fs[DEFAULT_MODE](
    filePath,
    req.body.responseData,
    options,
    async (err: any) => {
      if (err) {
        console.log(err)
        res.send('Error')
      } else {
        console.log('File written successfully!')

        // Add data to Firestore
        switch (requestName) {
          case 'chatusers':
            await processUsers(responseJson)
            break
          case 'chatdata':
            await processChatData(responseJson)
            break
          default:
            console.log('No processing for requestName: ', requestName)
            break
        }

        console.log(getDateTimeString())
        console.log('Request processed successfully!')
        res.send('Success')
      }
    }
  )
})

const processUsers = async (responseJson: any) => {
  const users = responseJson.users as ChatUser[]
  let userChangeDetected = false

  const chatDoc = await db.collection('zaletChat').doc('generalChat')

  const chat = (await chatDoc.get()).data()

  for (let user of users) {
    // check if exists
    const userAlreadySaved = chat?.savedUsers?.includes(user.user_id)
    if (userAlreadySaved) {
      console.log(`User: ${user.name} already exists`)
      continue
    }
    userChangeDetected = true
    console.log(`Inserting user: ${user.name}`)
    await addToCollection('zaletChat/generalChat/users', user)
  }

  if (userChangeDetected) {
    const allUsers = [
      ...(chat?.savedUsers || []),
      ...users.map((u) => u.user_id)
    ]
    const allUsersSet = new Set(allUsers)
    chatDoc.update({
      lastUserUpdate: getDateTimeString(),
      savedUsers: Array.from(allUsersSet)
    })
  }

  console.log('\nUsers successfully processed!')

  return Promise.resolve()
}

const processChatData = async (responseJson: any) => {
  const chatDoc = await db.collection('zaletChat').doc('generalChat')
  const chat = (await chatDoc.get()).data()

  currentUser = chat?.currentUser

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
  const rawResponse = JSON.stringify(chatData)

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

  const messagesToUpdate: Message[] = [
    ...allMessages.filter((m) => m.message_id > lastSavedMessageId)
  ]
  console.log(`Found ${messagesToUpdate.length} new messages to insert.`)

  if (!init) {
    allMessages.forEach((m, i) => {
      if (!deepEqual(m, previousMessages[i])) {
        messagesToUpdate.push(m)
        console.log(`Change in message ${m.message_id} detected!`)
        console.log('m: ', m)
        console.log('Previous', previousMessages[i])
      }
    })
  }

  console.log(`Found ${messagesToUpdate.length} messages to update.`)

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
      await addToCollection('zaletChat/generalChat/messages', m)
    }
  }

  const hasNewMessages = messagesToUpdate.length > 0
  if (hasNewMessages) {
    eagerModeActive = false

    participants = await getParticipants(chatData.threads[0]?.participants)
  }

  await db
    .collection('zaletChat')
    .doc('generalChat')
    .update({
      lastUpdate: getDateTimeString(),
      totalMessages: chatData.messages.length || 0,
      users: participants.length ? participants : chat?.users || [],
      participantsCount:
        chatData.threads[0]?.participantsCount || chat?.participantsCount || 0,
      lastMessageId: lastMessageId || lastSavedMessageId
    })

  if (messagesToUpdate.length > 0) {
    console.log('\nMessages successfully processed!')
  }

  return Promise.resolve()
}

const addToCollection = async (collectionName: string, data: any) => {
  try {
    const docRef = await db.collection(collectionName).add(data)

    console.log(`Document written with ID: ${docRef.id}\n`)
  } catch (e) {
    console.error('Error adding document: ', e)
  }
}

const generateFilenameWithDate = (name: string, extension = 'json') => {
  const dateYmd = new Date()
    .toLocaleDateString('en-GB')
    .split('/')
    .reverse()
    .join('-')
  const hourAndMinuteString = new Date()
    .toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    })
    .replace(':', '-')

  return `${name}_${dateYmd}_${hourAndMinuteString}.${extension}`
}

const getDateTimeString = (date?: Date) => {
  return (date || new Date())
    .toLocaleString('en-GB', { timeZone: 'Europe/Belgrade' })
    .replaceAll('/', '.')
    .replace(',', '.')
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
  // const isTenthMinute = new Date().getMinutes() % 10 === 0
  let responseJson

  try {
    responseJson = await pingZalet(MESSAGES)
    lastUpdate = responseJson.currentTime
    telegramSent = false
    errorCount = 0
  } catch (e) {
    console.error('Error fetching messages')
    // notify telegram to update cookies
    errorCount++
    if (errorCount > 3) {
      sendTelegramMessage('Error fetching messages, check cookies ASAP!')
      errorCount = 0
      telegramSent = true
    }
    checkInProgress = false
    return Promise.resolve()
  }

  console.log('fetched messages: ', responseJson.messages.length)

  await processChatData(responseJson)
  if (responseJson.messages.length > 100 && new Date().getMinutes() % 1 === 0) {
    const filename = generateFilenameWithDate('chatdata')
    console.log(`Saving response to file: ${filename}`)

    fs.writeFileSync(`${folderPath}${filename}`, JSON.stringify(responseJson))
  }

  checkInProgress = false
  return Promise.resolve()
}

const sendTelegramMessage = (message: string): Promise<any> => {
  const url = `https://api.telegram.org/bot7044628693:AAG4LnbOMzmMXdqZTJR93riWSJzE-o5KNfA/sendMessage?chat_id=1370480299&text=${encodeURI(
    message
  )}`

  return fetch(url)
}

const getParticipants = async (participants: number[]): Promise<ChatUser[]> => {
  console.log(getDateTimeString())
  console.log('Checking for participants')

  let responseJson

  try {
    responseJson = await pingZalet(PARTICIPANTS, participants)
    telegramSent = false
    errorCount = 0
  } catch (e) {
    console.error('Error fetching users')
    // notify telegram to update cookies
    errorCount++
    if (errorCount > 3) {
      sendTelegramMessage('Error fetching users, check cookies ASAP!')
      errorCount = 0
      telegramSent = true
    }
    return Promise.resolve([])
  }
  console.log('fetched users: ', responseJson.users.length)

  const isTenthMinute = true //new Date().getMinutes() % 10 === 0
  // await processUsers(responseJson)

  if (isTenthMinute && responseJson.users.length > 0) {
    const filename = generateFilenameWithDate('chatusers')
    console.log(`Saving response to file: ${filename}`)

    fs.writeFileSync(`${folderPath}${filename}`, JSON.stringify(responseJson))
  }

  return Promise.resolve(responseJson.users)
}
