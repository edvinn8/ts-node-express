// src/index.ts
import dotenv from 'dotenv'
import express, { Express, Request, Response } from 'express'

import bodyParser from 'body-parser'
import fs from 'fs'
import * as shell from 'shelljs'

import { firestore } from 'firebase-admin'
import path from 'path'
import { Chat, ChatUser } from './chat.model'
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const serviceAccount = require('D:/Development/servicekeys/zale-wiki-6af17806a991.json')

// Variables
const timestamp = Date.now()
const MESSAGES = `https://zalet.zaleprodukcija.com/wp-json/better-messages/v1/checkNew?nocache=${timestamp}`
const MESSAGES_INTERVAL = 1000 * 60 // every 1 minute
const USERS = `https://zalet.zaleprodukcija.com/wp-json/better-messages/v1/thread/8?nocache=${timestamp}`
const USERS_INTERVAL = 1000 * 60 * 5 // every 5 minutes
// load nonce and cookie from firebase, make them editable on UI
const WP_NONCE = 'c2ea4f247e'
const WP_COOKIE = 'pmpro_visit=1; rstr_script=lat; sbjs_current=typ%3Dtypein%7C%7C%7Csrc%3D%28direct%29%7C%7C%7Cmdm%3D%28none%29%7C%7C%7Ccmp%3D%28none%29%7C%7C%7Ccnt%3D%28none%29%7C%7C%7Ctrm%3D%28none%29%7C%7C%7Cid%3D%28none%29; sbjs_current_add=fd%3D2024-07-19%2021%3A50%3A14%7C%7C%7Cep%3Dhttps%3A%2F%2Fzalet.zaleprodukcija.com%2F%7C%7C%7Crf%3Dhttps%3A%2F%2Fzalet.zaleprodukcija.com%2Fvideo%2Fw9aAnqjbvM%2F; sbjs_first=typ%3Dtypein%7C%7C%7Csrc%3D%28direct%29%7C%7C%7Cmdm%3D%28none%29%7C%7C%7Ccmp%3D%28none%29%7C%7C%7Ccnt%3D%28none%29%7C%7C%7Ctrm%3D%28none%29%7C%7C%7Cid%3D%28none%29; sbjs_first_add=fd%3D2024-07-19%2021%3A50%3A14%7C%7C%7Cep%3Dhttps%3A%2F%2Fzalet.zaleprodukcija.com%2F%7C%7C%7Crf%3Dhttps%3A%2F%2Fzalet.zaleprodukcija.com%2Fvideo%2Fw9aAnqjbvM%2F; sbjs_migrations=1418474375998%3D1; sbjs_session=pgs%3D1%7C%7C%7Ccpg%3Dhttps%3A%2F%2Fzalet.zaleprodukcija.com%2F; sbjs_udata=vst%3D2%7C%7C%7Cuip%3D%28none%29%7C%7C%7Cuag%3DMozilla%2F5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F126.0.0.0%20Safari%2F537.36; wfwaf-authcookie-6273d8fc5d93b8b24364bfcaa11d7abc=149%7Csubscriber%7Cread%7C57a33e69632d021810dc82f8e7dba724dc5d833020fb99fdb7f22d27d26d878e; woocommerce_cart_hash=1fd9fcd827e57b08e44efe5e8f041e83; woocommerce_items_in_cart=1; wordpress_logged_in_e4b854345f11710563dd20cc605ba00e=n.eminentis%7C1721598622%7CWJA442jDiJrLKEVm4vtn7gpg1ViDDCezSGV4VdkXCBZ%7C893c3bc0dac97ba09f80e192a7d339e920b702fdc3980f477b6740ac1395123b; wordpress_test_cookie=WP%20Cookie%20check; wp_woocommerce_session_e4b854345f11710563dd20cc605ba00e=149%7C%7C1721598623%7C%7C1721595023%7C%7C53cd0651475908236c56c2e8ef7f206c'

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

/* Start the Express app and listen
 for incoming requests on the specified port */
app.listen(port, async () => {
  console.log(
    'ResponsesToFile App is listening now! Send them requests my way!'
  )
  console.log(`Data is being stored at location: ${folderPath}`)

  console.log(
    `Messages will be checked every ${MESSAGES_INTERVAL / 1000 / 60} minutes`
  )
  console.log(
    `Users will be checked every ${USERS_INTERVAL / 1000 / 60} minutes`
  )

  // random number between 100 and 900
  const randomOffset = Math.floor(Math.random() * 800) + 100
  const isTenthMinute = new Date().getMinutes() % 10 === 0

  setInterval(async () => {
    console.log('Checking for new messages')

    let responseJson

    try {
      responseJson = await pingZalet(MESSAGES)
    } catch (e) {
      console.error('Error fetching messages')
      // notify telegram to update cookies
      return
    }

    console.log('fetched messages: ', responseJson.messages.length)

    await processChatData(responseJson)
    if (isTenthMinute && responseJson.messages.length > 0) {
      const filename = generateFilenameWithDate('chatdata')
      console.log(`Saving response to file: ${filename}`)

      fs.writeFileSync(`${folderPath}${filename}`, JSON.stringify(responseJson))
    }
  }, MESSAGES_INTERVAL + randomOffset)

  setInterval(async () => {
    console.log('Checking for new users')

    let responseJson

    try {
      responseJson = await pingZalet(USERS)
    } catch (e) {
      console.error('Error fetching users')
      // notify telegram to update cookies
      return
    }
    console.log('fetched users: ', responseJson.users.length)

    await processUsers(responseJson)
    if (isTenthMinute && responseJson.users.length > 0) {
      const filename = generateFilenameWithDate('chatusers')
      console.log(`Saving response to file: ${filename}`)

      fs.writeFileSync(`${folderPath}${filename}`, JSON.stringify(responseJson))
    }
  }, USERS_INTERVAL)
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
      lastUpdate: Date.now(),
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
  let lastSavedMessageId = chat?.lastMessageId

  if (!lastSavedMessageId) {
    const doc = await db
      .collection('zaletChat/generalChat/messages')
      .orderBy('message_id', 'desc')
      .get()
    lastSavedMessageId = doc.docs[0].data().message_id
  }

  console.log('Last saved message id: ', lastSavedMessageId)

  const chatData = responseJson as Chat
  const messagesToWrite = chatData.messages.filter(
    (m) => m.message_id > lastSavedMessageId
  )

  console.log(`\n${messagesToWrite.length} new messages!\n`)

  let lastMessageId = 0

  // insert messages
  for (let m of messagesToWrite) {
    console.log(
      `Inserting new message: Id: ${m.message_id}, message: ${m.message}`
    )

    lastMessageId = m.message_id
    await addToCollection('zaletChat/generalChat/messages', m)
  }

  await db
    .collection('zaletChat')
    .doc('generalChat')
    .update({
      lastUpdate: getDateTimeString(),
      totalMessages: chatData.messages.length || chat?.totalMessages || 0,
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

const getDateTimeString = () => {
  return new Date()
    .toLocaleString('en-GB', { timeZone: 'Europe/Belgrade' })
    .replaceAll('/', '.')
    .replace(',', '.')
}
