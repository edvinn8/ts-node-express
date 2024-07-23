// src/index.ts
import dotenv from 'dotenv'
import express, { Express, Request, Response } from 'express'

import bodyParser from 'body-parser'
import fs from 'fs'
import * as shell from 'shelljs'

import { firestore } from 'firebase-admin'
import path from 'path'
import { Chat, ChatConfig, ChatUser } from './chat.model'
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const serviceAccount = require('D:/Development/servicekeys/zale-wiki-6af17806a991.json')

// Variables
const timestamp = Date.now()
const MESSAGES = `https://zalet.zaleprodukcija.com/wp-json/better-messages/v1/checkNew?nocache=${timestamp}`
const MESSAGES_INTERVAL = 1000 * 15 // every 1 minute
const USERS = `https://zalet.zaleprodukcija.com/wp-json/better-messages/v1/thread/8?nocache=${timestamp}`
// const USERS_INTERVAL = 1000 * 60 * 5 // every 5 minutes
// load nonce and cookie from firebase, make them editable on UI
let WP_NONCE = 'c6aab75d0d'
let WP_COOKIE =
  'rstr_script=lat; pmpro_visit=1; sbjs_migrations=1418474375998%3D1; sbjs_current_add=fd%3D2024-07-19%2021%3A50%3A14%7C%7C%7Cep%3Dhttps%3A%2F%2Fzalet.zaleprodukcija.com%2F%7C%7C%7Crf%3Dhttps%3A%2F%2Fzalet.zaleprodukcija.com%2Fvideo%2Fw9aAnqjbvM%2F; sbjs_first_add=fd%3D2024-07-19%2021%3A50%3A14%7C%7C%7Cep%3Dhttps%3A%2F%2Fzalet.zaleprodukcija.com%2F%7C%7C%7Crf%3Dhttps%3A%2F%2Fzalet.zaleprodukcija.com%2Fvideo%2Fw9aAnqjbvM%2F; sbjs_current=typ%3Dtypein%7C%7C%7Csrc%3D%28direct%29%7C%7C%7Cmdm%3D%28none%29%7C%7C%7Ccmp%3D%28none%29%7C%7C%7Ccnt%3D%28none%29%7C%7C%7Ctrm%3D%28none%29%7C%7C%7Cid%3D%28none%29; sbjs_first=typ%3Dtypein%7C%7C%7Csrc%3D%28direct%29%7C%7C%7Cmdm%3D%28none%29%7C%7C%7Ccmp%3D%28none%29%7C%7C%7Ccnt%3D%28none%29%7C%7C%7Ctrm%3D%28none%29%7C%7C%7Cid%3D%28none%29; wordpress_test_cookie=WP%20Cookie%20check; wfwaf-authcookie-6273d8fc5d93b8b24364bfcaa11d7abc=149%7Csubscriber%7Cread%7C56e6d821f13cd028f15962968a6efea8b9efad1b5dcacad5178e98cf7473119f; sbjs_udata=vst%3D4%7C%7C%7Cuip%3D%28none%29%7C%7C%7Cuag%3DMozilla%2F5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F126.0.0.0%20Safari%2F537.36; wordpress_logged_in_e4b854345f11710563dd20cc605ba00e=n.eminentis%7C1722815980%7CY1ketdFsWWUEC8aB0eDY4xFnHa34bLDc42h63Cc6AeU%7Cea298f62dbfb139590b3426447cdd247abdb621f820cb5b7a9fff90714289139; woocommerce_items_in_cart=1; woocommerce_cart_hash=1fd9fcd827e57b08e44efe5e8f041e83; wp_woocommerce_session_e4b854345f11710563dd20cc605ba00e=149%7C%7C1721779181%7C%7C1721775581%7C%7C8951c17c3cea2f87bd3218c6da9a8447; sbjs_session=pgs%3D2%7C%7C%7Ccpg%3Dhttps%3A%2F%2Fzalet.zaleprodukcija.com%2F'

let telegramSent = false
let eagerModeActive = false

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
  // console.log(
  //   `Users will be checked every ${USERS_INTERVAL / 1000 / 60} minutes\n`
  // )

  const chatDoc = await db.collection('config').doc('chatConfig')
  const chatConfig = (await chatDoc.get()).data() as ChatConfig

  if (!!chatConfig) {
    console.log('Config fetched successfully.')
    console.log(
      'Config date: ',
      getDateTimeString(chatConfig.updatedAt.toDate()) + '\n'
    )
  }

  WP_NONCE = chatConfig.wpNonce
  WP_COOKIE = chatConfig.wpCookie

  // random number between 100 and 900
  const randomOffset = Math.floor(Math.random() * 800) + 100

  setInterval(async () => {
    await getMessages()
  }, MESSAGES_INTERVAL + randomOffset)

  db.collection('manualTriggers')
    .where('eventType', '==', 'sendToZaletChat')
    .onSnapshot(async (doc) => {
      if (!init) {
        console.log('Manual trigger received')
        eagerModeActive = true
        await getMessages()

        let counter = 0
        const checkInterval = setInterval(async () => {
          await getMessages()

          counter++
          if (counter > 10 || !eagerModeActive) {
            clearInterval(checkInterval)
          }
        }, 2000)
      }

      init = false
    })
})

app.post('/test', async (req, res) => {
  console.log('Test request received')
  const fetchedResponse = await pingZalet(MESSAGES)
  console.log('fetched messages: ', fetchedResponse.messages.length)

  res.send(fetchedResponse)
})

const pingZalet = async (url: string) => {
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'X-WP-Nonce': WP_NONCE,
      host: 'zalet.zaleprodukcija.com',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: WP_COOKIE
    },
    body: JSON.stringify({
      lastUpdate,
      visibleThreads: [],
      threadIds: [8]
    })
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
  console.log()
  console.log(getDateTimeString())
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
    const userAlreadySaved = chat?.savedUsers.includes(user.user_id)
    if (userAlreadySaved) {
      console.log(`User: ${user.name} already exists`)
      continue
    }
    userChangeDetected = true
    console.log(`Inserting user: ${user.name}`)
    await addToCollection('zaletChat/generalChat/users', user)
  }

  if (userChangeDetected) {
    const allUsers = [...chat?.savedUsers, ...users.map((u) => u.user_id)]
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
  const savedUsers = chat?.savedUsers || []
  let lastSavedMessageId = chat?.lastMessageId

  // if (!lastSavedMessageId) {
  //   const doc = await db
  //     .collection('zaletChat/generalChat/messages')
  //     .orderBy('message_id', 'desc')
  //     .get()
  //   lastSavedMessageId = doc.docs[0].data().message_id
  // }

  console.log('Last saved message id: ', lastSavedMessageId)

  const chatData = responseJson as Chat
  const messagesToWrite = chatData.messages.filter(
    (m) => m.message_id > lastSavedMessageId
  )

  const hasNewMessages = messagesToWrite.length > 0
  console.log(`\n${messagesToWrite.length} new messages!\n`)

  if (hasNewMessages) {
    eagerModeActive = false

    // check users
    const usersToCheckSet = new Set(messagesToWrite.map((m) => m.sender_id))
    const usersToCheck = Array.from(usersToCheckSet).filter(
      (u) => !savedUsers.includes(u)
    )

    if (usersToCheck.length > 0) {
      console.log('New users detected, fetching users')
      await getUsers()
    }
  }

  let lastMessageId = 0

  // insert messages
  for (let m of messagesToWrite) {
    console.log(
      `Inserting new message: Id: ${m.message_id}, message: ${m.message}`
    )

    lastMessageId = m.message_id
    await addToCollection('zaletChat/generalChat/messages', m)
  }

  let totalMessages = chatData.messages.length > chat?.totalMessages ? chatData.messages.length : chat?.totalMessages + chatData.messages.length;
  await db
    .collection('zaletChat')
    .doc('generalChat')
    .update({
      lastUpdate: getDateTimeString(),
      totalMessages: totalMessages || 0,
      participantsCount:
        chatData.threads[0]?.participantsCount || chat?.participantsCount || 0,
      lastMessageId: lastMessageId || lastSavedMessageId
    })

  if (messagesToWrite.length > 0) {
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
  console.log(getDateTimeString())
  console.log('Checking for new messages')
  const isTenthMinute = new Date().getMinutes() % 10 === 0
  let responseJson

  try {
    responseJson = await pingZalet(MESSAGES)
    lastUpdate = responseJson.currentTime
    telegramSent = false
  } catch (e) {
    console.error('Error fetching messages')
    // notify telegram to update cookies
    if (!telegramSent) {
      sendTelegramMessage('Error fetching messages, check cookies ASAP!')
      telegramSent = true
    }

    return Promise.resolve()
  }

  console.log('fetched messages: ', responseJson.messages.length)

  await processChatData(responseJson)
  if (isTenthMinute && responseJson.messages.length > 0) {
    const filename = generateFilenameWithDate('chatdata')
    console.log(`Saving response to file: ${filename}`)

    fs.writeFileSync(`${folderPath}${filename}`, JSON.stringify(responseJson))
  }

  return Promise.resolve()
}

const sendTelegramMessage = (message: string): Promise<any> => {
  const url = `https://api.telegram.org/bot7044628693:AAG4LnbOMzmMXdqZTJR93riWSJzE-o5KNfA/sendMessage?chat_id=1370480299&text=${encodeURI(
    message
  )}`

  return fetch(url)
}

const getUsers = async () => {
  console.log(getDateTimeString())
  console.log('Checking for new users')

  let responseJson

  try {
    responseJson = await pingZalet(USERS)
    telegramSent = false
  } catch (e) {
    console.error('Error fetching users')
    // notify telegram to update cookies
    if (!telegramSent) {
      sendTelegramMessage('Error fetching users, check cookies ASAP!')
      telegramSent = true
    }
    return
  }
  console.log('fetched users: ', responseJson.users.length)

  const isTenthMinute = new Date().getMinutes() % 10 === 0
  await processUsers(responseJson)

  if (isTenthMinute && responseJson.users.length > 0) {
    const filename = generateFilenameWithDate('chatusers')
    console.log(`Saving response to file: ${filename}`)

    fs.writeFileSync(`${folderPath}${filename}`, JSON.stringify(responseJson))
  }

  return Promise.resolve()
}
