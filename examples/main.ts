import { TextDecoder } from 'https://deno.land/std@0.120.0/node/util.ts'
import { createConnection, MouseButton, Key } from '../mod.ts'

const hostname = '192.168.1.240'
const port = 5900
const password = 'pass'

const client = await createConnection({
  hostname, port, password,
  onerror: (error: any) => {
    throw new Error(error)
  },
  onclose: () => {
    console.log('Connection closed.')
  },
  onconnected: () => {
    console.log('Successfully connected and authorised.')
    console.log(`Remote screen name: ${client.name} Width: ${client.width()} Height: ${client.height()}`)
  },
  onresize: () => {
    console.log(`Window size has been resized! Width: ${client.width()}, Height: ${client.height()}`)
  },
  onclipboard: (pasteBuffer: Uint8Array) => {
    console.log('Remote clipboard updated!', new TextDecoder().decode(pasteBuffer))
  },
  onbell: () => {
    console.log('Bell!')
  },
})

const routine1 = async (client: any) => {
  const { text, capture } = await client.read(400, 400, 600, 450) // request & wait for update, then OCR rect
  switch (text.toLowerCase()) {
    case 'ready':
      await client.click(425, 425)   // same as leftclick, mouse down, then mouse up
      break
    case 'loading':
      await client.rightclick(425, 425) // mouse down, then mouse up
      await client.leftclick(450, 450)  // same as click
      break
    default:
      console.log('Unknown text from routine1: ', text, capture)
  }
}
const drawSinWave = async (client: any) => {
  const a = 150
  const b = -0.2
  for (let step = 0; step < 111; step++) {
    await client.pointerDown(400 + step * 10, 750 + (Math.sin(step * b) * a))
  }
  await client.pointerUp(1500, 750)
}

// await client.framebufferUpdateRequest(0, 1500, 400, 1600)
// TODO: define explicit return type
// await client.key(Key.W)         // keycode - sends keydown, then keyup
// await client.key(Key.Up, Key.Super)         // keycode - sends keydown, then keyup

// await client.key(Key.ShiftTab)         // keycode - sends keydown, then keyup


// console.log(await client.framebufferUpdateRequest(20, 20, 140, 70))
// await client.framebufferUpdateRequest(20, 20, 140, 70)
// client.framebufferUpdateRequest(0, 0, 100, 100)
// await client.framebufferUpdateRequest(1000, 1000, 1020, 1020)

// console.log(text)

// TODO: set global pause

// await client.key(Key.Super)
// await client.pause(500)
// await client.type('term')
// await client.pause(500)
// await client.key(Key.Enter)
// await client.pause(500)
// await client.key(Key.Up, Key.Super)
// await client.pause(500)
// await client.type('ping 127.0.0.1')
// await client.key(Key.Up, Key.Super)
// await client.key(Key.Enter)


// await client.key(Key.x, Key.Control)
// await client.pause(500)
// await client.key(Key.v, Key.Control)
// await client.key(Key.v, Key.Control)
// await client.pause(8000)

// await client.updateClipboard('Hello!') // update server clipboard
// await client.pause(1000)               // timeout helper
// await client.pointerDown(600, 600)    // x, y, button state (bit mask for each mouse button)
// await client.pointerUp(600, 600)    // x, y, button state (bit mask for each mouse button)

// await client.click(800, 800)       // x, y - same as leftclick unless button number specified
// await client.doubleClick(100, 100) // x, y - two clicks, 100ms apart
// await client.leftClick(100, 100)   // x, y
// await client.rightClick(300, 400)  // x, y
// await client.middleClick(100, 100) // x, y
// await client.keyDown(Key.Shift)     // keycode
// await client.key(44)         // keycode - sends keydown, then keyup
// await client.key('4')         // keycode - sends keydown, then keyup
// await client.keyUp(Key.Shift)       // keycode
// await client.type('Hello!')  // sends key events
// await client.key('s', Key.Shift, Key.Control)         // keycode - sends keydown, then keyup
// await client.cad()           // sends control + alt + delete

// await routine1(client)   // call a routine within a regular flow
// await routine1(client)   // call a routine within a regular flow

// const { text } = await client.read(400, 400, 600, 450)       // request & wait for update, then OCR rect
// const { capture } = await client.capture(400, 400, 600, 450) // request & wait for update
// const color = await client.sampleColor(700, 600)             // returns the hex color at x,y

// await client.matchIcon(700, 600, 'path/to/icon.png')  // request & wait for update, then try to match icon
//   ? await client.middleClick(100, 100)
//   : console.log('The icon does not match!')

// const {text, capture} = await client.recognize(30, 30, 140, 70)
// const file = await Deno.create(`./${Date.now()}.png`)
// await file.write(capture)

if (await client.matchText(30, 30, 140, 70, 'open')) {
  await client.click(50, 50)
  // console.log('The text DOES match!')
} else {
  console.log('The text does NOT match!')
}

await client.end() // close connection