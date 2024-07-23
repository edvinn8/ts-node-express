// src/index.ts
import dotenv from 'dotenv'
import express, { Express, Request, Response } from 'express'

import { firestore } from 'firebase-admin'
var request = require('request')

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
var http = require('https')
/* Start the Express app and listen
 for incoming requests on the specified port */
app.listen(port, async () => {
  const test = await fetch('http://zalet.zaleprodukcija.com/wp-login.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'http://zalet.zaleprodukcija.com',
      Referer: 'http://zalet.zaleprodukcija.com/wp-login.php',
      'Access-Control-Expose-Headers': '*' // 'Set-Cookie'
    },
    body: JSON.stringify({
      log: 'ranko.knezevic1',
      pwd: 'Download12%23%24',
      rememberme: 'forever',
      'wp-submit': '%D0%9F%D1%80%D0%B8%D1%98%D0%B0%D0%B2%D0%B0',
      redirect_to: 'https%3A%2F%2Fzalet.zaleprodukcija.com%2Fwp-admin%2F',
      testcookie: '1'
    }),
    credentials: 'include'
  })

  console.log(`Status: ${test.status}`)
  const t = test.headers.getSetCookie() 
  console.log('test: ', test);

  console.log('Possibly cookie: ', t)

  const headersEntries = test.headers.values()
  let cookie = ''
  for (const header of headersEntries) {
    console.log('header: ', header)
    // console.log(`${header[0]}: ${header[1]}`)
  }
})
