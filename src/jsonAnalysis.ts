import { Chat } from './chat.model'

const reactions = ['1f44c', '1f44d', '1f60d', '1f632', '1f914', '2b50', '1f921', '1f92e', '1f4a9']
const chatDataString: string = require('D:/Development/Backup/RequestResponses/chatdata_2024-11-04_14-00.json') // './Responses/',

const chatData: Chat = JSON.parse(chatDataString)

chatData.messages
  .filter((m) => m.sender_id == 1909 && !!m.meta?.reactions)
  .forEach((m) => {
    // console.log(m);
    // console.log(m.meta);
  })

const s = new Set()
chatData.messages
  .filter(
    (m) =>
      m.message_id > 30000 &&
      m.meta?.reactions
        ?.flatMap((r) => r.reaction)
        .some((r) => !reactions.includes(r))
  )
  .forEach((m) => {
    const rs = m.meta?.reactions?.flatMap((r) => r.reaction)

    rs?.forEach((r) => {
      s.add(r)
    })

    // console.log(m);
    // console.log(m.meta)
  })

console.log(s.values())
