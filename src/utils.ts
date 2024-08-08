import { Firestore } from '@google-cloud/firestore'
import { MetaMeta, ReactionUpdate } from './chat.model'

const ZALET_CHAT_URL =
  'https://zalet.zaleprodukcija.com/wp-json/better-messages/v1/thread/8'

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

export const sendTelegramMessage = (message: string): Promise<any> => {
  const url = `https://api.telegram.org/bot7044628693:AAG4LnbOMzmMXdqZTJR93riWSJzE-o5KNfA/sendMessage?chat_id=1370480299&text=${encodeURI(
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
    return Promise.reject(new Error('Error sending reaction to Zalet chat!'))
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
