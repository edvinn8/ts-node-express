import { Firestore } from '@google-cloud/firestore'
import {
  ChatUserConfig,
  ManualTriggerEventType,
  MetaMeta,
  ReactionUpdate
} from './chat.model'

const ZALET_CHAT_URL =
  'https://zalet.zaleprodukcija.com/wp-json/better-messages/v1/thread/8'
const FILE_UPLOAD_URL = `${ZALET_CHAT_URL}/upload?nocache=${Date.now()}`

export const addToCollection = async (
  db: Firestore,
  collectionName: string,
  data: any
) => {
  try {
    const docRef = await db.collection(collectionName).add(data)

    console.log(`Document written with ID: ${docRef.id}\n`)
  } catch (e) {
    console.error('Error adding document: ', e)
  }
}

export const generateFilenameWithDate = (name: string, extension = 'json') => {
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

export const getDateTimeString = (date?: Date) => {
  return (date || new Date())
    .toLocaleString('en-GB', { timeZone: 'Europe/Belgrade' })
    .replaceAll('/', '.')
    .replace(',', '.')
}

export const BOT_TOKENS = {
  ZALE_WIKI: {
    token: '7044628693:AAG4LnbOMzmMXdqZTJR93riWSJzE-o5KNfA',
    chat_id: '1370480299'
  },
  ZALET_KLJIPSI: {
    token: '7388879819:AAFlgH1QCQEFQs2gqLyqj5_-bspKtmSn8nU',
    chat_id: '-1002158205019'
  },
  ZALET_KLJIPSI_KLIPOVI: {
    token: '7388879819:AAFlgH1QCQEFQs2gqLyqj5_-bspKtmSn8nU',
    chat_id: '-4543379103'
  }
}

export const sendTelegramMessage = (
  message: string,
  token: string = BOT_TOKENS.ZALE_WIKI.token,
  chat_id: string = BOT_TOKENS.ZALE_WIKI.chat_id
): Promise<any> => {
  const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&text=${encodeURI(
    message
  )}`

  return fetch(url)
}

export async function getFileFromUrl(/** @type {string} */ url: string) {
  const response = await fetch(url)
  return response.blob()
}

export async function sendMessageToZaletChat(
  db: Firestore,
  message: string,
  meta?: MetaMeta
): Promise<Response> {
  const chatDoc = await db.collection('config').doc('chatConfig')
  const chatConfig = (await chatDoc.get()).data()

  const timestamp = Date.now()
  const body = JSON.stringify({
    message,
    temp_id: 'tmp_247_31726704',
    temp_time: timestamp,
    meta: meta ?? {}
  })

  const url = `${ZALET_CHAT_URL}/send?nocache=` + timestamp

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'X-WP-Nonce': chatConfig?.wpNonce,
      host: 'zalet.zaleprodukcija.com',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: chatConfig?.wpCookie
    },
    body
  })

  if (!resp.ok) {
    return Promise.reject(new Error('Error sending message to Zalet chat!'))
  }

  return resp.json()
}

export async function sendReactionToZaletChat(
  db: Firestore,
  update?: ReactionUpdate
): Promise<Response> {
  const chatDoc = await db.collection('config').doc('chatConfig')
  const chatConfig = (await chatDoc.get()).data()

  const timestamp = Date.now()
  const body = JSON.stringify(update)

  const url =
    'https://zalet.zaleprodukcija.com/wp-json/better-messages/v1/reactions/save?nocache=' +
    timestamp

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'X-WP-Nonce': chatConfig?.wpNonce,
      host: 'zalet.zaleprodukcija.com',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: chatConfig?.wpCookie
    },
    body
  })

  if (!resp.ok) {
    console.log('Error sending reaction to Zalet chat!')
    console.log(`Status: ${resp.status}`)
    const error = await resp.json()
    return Promise.reject(new Error(error.message))
  }

  return resp.json()
}

export async function deleteMessageFromZaletChat(
  db: Firestore,
  id: number
): Promise<Response> {
  const chatDoc = await db.collection('config').doc('chatConfig')
  const chatConfig = (await chatDoc.get()).data()

  const timestamp = Date.now()
  const body = JSON.stringify({
    messageIds: [id]
  })

  const url = `${ZALET_CHAT_URL}/deleteMessages?nocache=` + timestamp

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'X-WP-Nonce': chatConfig?.wpNonce,
      host: 'zalet.zaleprodukcija.com',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: chatConfig?.wpCookie
    },
    body
  })

  if (!resp.ok) {
    return Promise.reject(new Error('Error deleting message from Zalet chat!'))
  }

  return resp.json()
}

async function uploadFile(file: Blob, currentUser: ChatUserConfig) {
  const formData = new FormData()
  formData.set('file', file, 'file.jpg')
  return fetch(FILE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'X-WP-Nonce': currentUser.wpNonce,
      host: 'zalet.zaleprodukcija.com',
      Accept: 'application/json, text/plain, */*',
      Cookie: currentUser.wpCookie
    },
    body: formData
  })
}

async function sendImageToChat(
  fileId: number,
  currentUser: ChatUserConfig
): Promise<Response> {
  const timestamp = Date.now()
  const body = JSON.stringify({
    message: '',
    files: [fileId],
    meta: {}
  })

  const url = `${ZALET_CHAT_URL}/send?nocache=` + timestamp

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'X-WP-Nonce': currentUser.wpNonce,
      host: 'zalet.zaleprodukcija.com',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Cookie: currentUser.wpCookie
    },
    body
  })

  if (!resp.ok) {
    return Promise.reject(new Error('Error sending image to Zalet chat!'))
  }

  return resp.json()
}

export async function processManualTrigger(
  eventType: ManualTriggerEventType,
  data: any,
  db: Firestore
): Promise<Response> {
  try {
    switch (eventType) {
      case ManualTriggerEventType.SEND_MESSAGE_TO_ZALET: {
        const message = data.message
        console.log(`Sending message to Zalet chat: ${message}`)
        await sendMessageToZaletChat(db, message)
        break
      }
      case ManualTriggerEventType.REPLY_TO_ZALET: {
        const { message, meta } = data
        console.log(
          `Replying in Zalet chat to id: ${meta.reply_to}, message: ${message}`
        )
        await sendMessageToZaletChat(db, message, meta)
        break
      }
      case ManualTriggerEventType.REACT_TO_ZALET: {
        const update = data.update as ReactionUpdate
        console.log(
          `Updating reaction in Zalet chat for message: ${update.message_id}`
        )
        await sendReactionToZaletChat(db, update)
        break
      }
      case ManualTriggerEventType.SEND_FILE_TO_ZALET: {
        const file = await getFileFromUrl(data.message)
        const res = await uploadFile(file, data.currentUser)
        const t = await res.json()
        console.log('Uploaded file with id:', t.id)
        const response = await sendImageToChat(t.id, data.currentUser)
        console.log('response: ', response)
        break
      }
      case ManualTriggerEventType.DELETE_MESSAGE_FROM_ZALET: {
        const messageId = data.idToDelete
        console.log(`Deleting message ${messageId} from Zalet chat!`)
        await deleteMessageFromZaletChat(db, messageId)
        break
      }
      default:
        break
    }
  } catch (e: any) {
    console.error('Error processing manual trigger: ', e.message)
  }

  return Promise.resolve(new Response('OK'))
}
