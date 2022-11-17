import { Key } from './keycodes.ts'
import { encode } from 'https://deno.land/x/pngs@0.1.1/mod.ts'
import { response } from './d3des.ts'
import { ocr } from './tesseract/tesseractOCR.ts'


export type rfbConnection = {
  width: number
  height: number

  requestUpdate(incremental: boolean, x: number, y: number, width: number, height: number): void
  end(): void
}


export enum MouseButton {
  Left = 0b00000001,
  Middle = 0b00000010,
  Right = 0b00000100,
  WheelUp = 0b00001000,
  WheelDown = 0b00010000,
  MB6 = 0b00100000,
  MB7 = 0b01000000,
  MB8 = 0b10000000,
}


export enum ButtonState {
  Up = 0,
  Down = 1
}


export const createConnection = async ({
  hostname = '127.0.0.1',
  port = 5900,
  shared = true,
  password = '',
  onerror = (error: any) => {
    throw new Error(error)
  },
  onclose = () => { },
  onconnected = () => { },
  onresize = () => { },
  onclipboard = (pasteBuffer: Uint8Array) => { },
  onbell = () => { },
}) => {
  // Try to establish connection
  const connection = await Deno.connect({ hostname, port })
    .catch(err => Promise.reject(err))
  const te = new TextEncoder()
  const td = new TextDecoder()


  // Negotiate RFB protocol version
  // https://datatracker.ietf.org/doc/html/rfc6143#section-7.1.1
  const highestVersion = [3, 8]
  const versionBuffer = new Uint8Array(12)
  await connection.read(versionBuffer)
  const versionDecoded = td.decode(versionBuffer)
  if (versionDecoded.slice(0, 4) !== 'RFB ') Promise.reject(`Invalid server VNC version: '${versionDecoded}'`)
  const serverVersion = [parseInt(versionDecoded.slice(4, 7)), parseInt(versionDecoded.slice(8, 11))]

  // TODO: Clean this up. It works, but is ugly.
  const version = highestVersion[0] < serverVersion[0]
    ? highestVersion
    : highestVersion[0] > serverVersion[0]
      ? serverVersion
      : highestVersion[1] < serverVersion[1]
        ? highestVersion
        : serverVersion
  await connection.write(te.encode(`RFB ${String(version[0]).padStart(3, '0')}.${String(version[1]).padStart(3, '0')}\n`))

  // Security Handshake
  // https://datatracker.ietf.org/doc/html/rfc6143#section-7.1.2
  enum securityType {
    Invalid = 0,
    None = 1,
    VNCAuthentication = 2,
  }

  enum securityResult {
    OK = 0,
    failed = 1,
  }

  const numberOfSecurityTypes = new Uint8Array(1)
  await connection.read(numberOfSecurityTypes)
  const securityTypesBuffer = new Uint8Array(numberOfSecurityTypes[0])
  await connection.read(securityTypesBuffer)
  const supportedSecurity = Array.from(securityTypesBuffer)


  if (supportedSecurity.includes(securityType.Invalid)) {
    Promise.reject('Invalid security types.')
  } else if (supportedSecurity.includes(securityType.None)) {
    await connection.write(new Uint8Array([1]))
  } else if (supportedSecurity.includes(securityType.VNCAuthentication)) {
    // https://datatracker.ietf.org/doc/html/rfc6143#section-7.2.2
    await connection.write(new Uint8Array([2]))
    const securityChallengeBuffer = new Uint8Array(16)
    await connection.read(securityChallengeBuffer)
    const challengeResponse = response(securityChallengeBuffer, password)
    await connection.write(challengeResponse)
  } else Promise.reject('Invalid security types.')


  const securityResultBuffer = new Uint8Array(4)
  await connection.read(securityResultBuffer)
  if (securityResultBuffer[3] === securityResult.failed
    || securityResultBuffer[3] !== securityResult.OK) {
    const failureLengthBuffer = new Uint8Array(4)
    await connection.read(failureLengthBuffer)
    const failureLength = (failureLengthBuffer[0] << 24) + (failureLengthBuffer[1] << 16) + (failureLengthBuffer[2] << 8) + failureLengthBuffer[3]
    const failureBuffer = new Uint8Array(failureLength)
    await connection.read(failureBuffer)
    const failure = td.decode(failureBuffer)
    Promise.reject(`Security negogiation failed: ${failure}`)
  }

  // https://datatracker.ietf.org/doc/html/rfc6143#section-7.3.1
  await connection.write(new Uint8Array([shared ? 1 : 0]))

  // https://datatracker.ietf.org/doc/html/rfc6143#section-7.3.2
  const initBuffer = new Uint8Array(24)
  await connection.read(initBuffer)
  let clientWidth = (initBuffer[0] << 8) + initBuffer[1]
  let clientHeight = (initBuffer[2] << 8) + initBuffer[3]
  const width = () => clientWidth
  const height = () => clientHeight


  // https://datatracker.ietf.org/doc/html/rfc6143#section-7.4
  const pixelFormat = {
    bitsPerPixel: initBuffer[4],
    bytesPerPixel: initBuffer[4] / 8,
    depth: initBuffer[5],
    bigEndianFlag: initBuffer[6],
    trueColorFlag: initBuffer[7],
    redMax: (initBuffer[8] << 8) + initBuffer[9],
    greenMax: (initBuffer[10] << 8) + initBuffer[11],
    blueMax: (initBuffer[12] << 8) + initBuffer[13],
    redShift: initBuffer[14],
    greenShift: initBuffer[15],
    blueShift: initBuffer[16],
    // 17,18,19 are padding
  }


  const nameLength = (initBuffer[20] << 24) + (initBuffer[21] << 16) + (initBuffer[22] << 8) + initBuffer[23]
  const nameBuffer = new Uint8Array(nameLength)
  await connection.read(nameBuffer)
  const name = td.decode(nameBuffer)


  // https://datatracker.ietf.org/doc/html/rfc6143#section-7.5
  enum ClientMsg {
    SetPixelFormat = 0,
    SetEncodings = 2,
    FramebufferUpdateRequest = 3,
    KeyEvent = 4,
    PointerEvent = 5,
    ClientCutText = 6,
  }


  const pause = async (time: number) =>
    await new Promise(resolve =>
      setTimeout(() => resolve(null), time))

  // https://datatracker.ietf.org/doc/html/rfc6143#section-7.5.1
  // TODO: SetPixelFormat

  // https://datatracker.ietf.org/doc/html/rfc6143#section-7.5.2
  // TODO: SetEncodings

  // https://datatracker.ietf.org/doc/html/rfc6143#section-7.5.3
  const framebufferRequests =
    new Map<String, (
      (frameBuffer: Uint8Array) => void)>([]);

  const framebufferUpdateRequest = (x1: number, y1: number, x2: number, y2: number, incremental = false) => {
    const width = Math.abs(x1 - x2)
    const height = Math.abs(y1 - y2)
    const x = Math.min(x1, x2)
    const y = Math.min(y1, y2)

    if (incremental) Promise.reject("Incremental framebuffer updates not implemented.")

    const framebufferPromise = new Promise<{ framebuffer: Uint8Array, width: number, height: number }>(resolve =>
      framebufferRequests.set(JSON.stringify([x, y, width, height]), fba =>
        resolve({ framebuffer: fba, width, height })
      ));

    const frame = new Uint8Array(Uint16Array.from([height, width, y, x]).buffer).reverse()

    connection.write(new Uint8Array(
      [ClientMsg.FramebufferUpdateRequest, incremental ? 1 : 0, ...frame]))

    return framebufferPromise
  }

  // const result = await ocr(frameBuffer, width, height)
  // const capture = encode(frameBuffer, width, height)

  // // const file = await Deno.create(`./captures/${Date.now()}.png`)
  // // await file.write(capture)

  // return {
  //   capture,
  //   text: result.text.toLowerCase().trim(),
  //   details: result,
  //   confidence: result.confidence,
  //   recognized: result.text
  // }

  // https://datatracker.ietf.org/doc/html/rfc6143#section-7.5.4
  const keyEvent = async (key: Key, state: ButtonState) => {
    const keyBuffer = new Uint8Array(Uint32Array.from([key]).buffer).reverse()
    await connection.write(new Uint8Array(
      [ClientMsg.KeyEvent, state, 0, 0, ...keyBuffer]))
  }


  const keyDown = async (key: Key) =>
    await keyEvent(key, ButtonState.Down)


  const keyUp = async (key: Key) =>
    await keyEvent(key, ButtonState.Up)


  /**
   * Sends a {@link keyDown}, then {@link keyUp} message for the keycode
   * or first character of the string provided.
   *
   * If modifiers are provided, then the main {@link keyEvent}s are nested inside
   * the modifiers keyDown and keyUp messages.
   */
  const key = async (key: Key | string, ...modifiers: Key[]) => {
    // Use .type('string') for more than one character.
    if (typeof key === 'string') {
      if (key.length != 1) {
        Promise.reject(`Invalid string length of ${key.length}: ${key}`)
      }
      key = key.charCodeAt(0)
    }

    // All modifiers down
    const modifiersReversed: Key[] = []
    while (modifiers.length > 0) {
      const modifier = modifiers.shift()
      if (!modifier) continue
      await pause(50)
      await keyEvent(modifier, ButtonState.Down)
        .catch(err => Promise.reject(err))
      modifiersReversed.unshift(modifier)
    }

    // Keycode, down then up
    await keyEvent(key, ButtonState.Down)
      .catch(err => Promise.reject(err))
    await pause(50)
    await keyEvent(key, ButtonState.Up)
      .catch(err => Promise.reject(err))

    // All modifier up in reverse order
    while (modifiersReversed.length > 0) {
      const modifier = modifiersReversed.shift()
      if (!modifier) continue
      await pause(50)
      await keyEvent(modifier, ButtonState.Up)
    }
  }

  /**
   * Sends Control + Alt + Delete using {@link key}.
   */
  const type = async (text: string, speed = 75) => {
    if (key.length < 1) Promise.resolve(null)

    for (let char = 0; char < text.length; char++) {
      await key(text.charCodeAt(char))
      await pause(speed)
    }
  }


  const cad = async () =>
    await key(Key.Delete, Key.Control, Key.Alt)


  // https://datatracker.ietf.org/doc/html/rfc6143#section-7.5.5
  let pointerState = 0b00000000
  const pointerEvent = async (x: number, y: number, button: MouseButton, state: ButtonState) => {
    pointerState = state ? pointerState | button : pointerState & ~button
    const positionBuffer = new Uint8Array(Uint16Array.from([y, x]).buffer).reverse()
    await connection.write(new Uint8Array(
      [ClientMsg.PointerEvent, pointerState, ...positionBuffer]))
  }


  const pointerDown = async (x: number, y: number, button = MouseButton.Left) =>
    await pointerEvent(x, y, button, ButtonState.Down)


  const pointerUp = async (x: number, y: number, button = MouseButton.Left) =>
    await pointerEvent(x, y, button, ButtonState.Up)


  const click = async (x: number, y: number, button = MouseButton.Left) => {
    await pointerDown(x, y, button)
      .catch(err => Promise.reject(err))
    await pointerUp(x, y, button)
  }


  const leftClick = async (x: number, y: number) =>
    await click(x, y, MouseButton.Left)


  const rightClick = async (x: number, y: number) =>
    await click(x, y, MouseButton.Right)


  const middleClick = async (x: number, y: number) =>
    await click(x, y, MouseButton.Middle)


  const doubleClick = async (x: number, y: number, button = MouseButton.Left, speed = 180) => {
    await click(x, y, button)
      .catch(err => Promise.reject(err))
    await pause(speed)
    await click(x, y, button)
  }


  // TODO: This isn't working (tkx11vnc - Zorin OS 16.2).
  // https://datatracker.ietf.org/doc/html/rfc6143#section-7.5.6
  const updateClipboard = async (text: string) => {
    const length = new Uint8Array(new Uint32Array([text.length]).buffer).reverse()
    await connection.write(new Uint8Array(
      [ClientMsg.ClientCutText, 0, 0, 0,
      ...length,
      ...te.encode(text)]))
  }


  let connectionOpen = true
  const end = async () => {
    connectionOpen = false
    connection.close()
    onclose()
  }


  enum ServerMsg {
    FramebufferUpdate = 0,
    SetColorMapEntries = 1,
    Bell = 2,
    ServerCutText = 3,
  }


  const readConnection = async () => {
    try {
      const ServerMsgBuffer = new Uint8Array(1)
      await connection.read(ServerMsgBuffer)

      switch (ServerMsgBuffer[0]) {
        case ServerMsg.FramebufferUpdate:
          if (!connectionOpen) break
          const fbUpdateBuffer = new Uint8Array(3)
          await connection.read(fbUpdateBuffer)

          const numberOfRectangles = (fbUpdateBuffer[1] << 8) + fbUpdateBuffer[2]
          for (let i = 0; i < numberOfRectangles; i++) {
            const rectHeaderBuffer = new Uint8Array(12)
            await connection.read(rectHeaderBuffer)

            const rectHeader = {
              x: (rectHeaderBuffer[0] << 8) + rectHeaderBuffer[1],
              y: (rectHeaderBuffer[2] << 8) + rectHeaderBuffer[3],
              width: (rectHeaderBuffer[4] << 8) + rectHeaderBuffer[5],
              height: (rectHeaderBuffer[6] << 8) + rectHeaderBuffer[7],
              encode: (rectHeaderBuffer[8] << 24) + (rectHeaderBuffer[9] << 16) + (rectHeaderBuffer[10] << 8) + rectHeaderBuffer[11],
            }

            if (rectHeader.encode === 0) { // raw encoding
              const numberOfBytes = pixelFormat.bytesPerPixel * rectHeader.width * rectHeader.height
              const frameBuffer = new Uint8Array(numberOfBytes)
              let recieved = 0
              while (recieved < numberOfBytes) {
                const remaining = numberOfBytes - recieved
                const frameBufferChunk = new Uint8Array(remaining > 1000 ? 1000 : remaining)
                const chunkSize = await connection.read(frameBufferChunk)

                frameBuffer.set(frameBufferChunk, recieved)
                recieved = recieved + (chunkSize || 0)
              }
              const frameBuffer32 = new Uint32Array(frameBuffer.buffer)
              const r = pixelFormat.redShift
              const g = pixelFormat.greenShift
              const b = pixelFormat.blueShift
              frameBuffer32.forEach((element, index) =>
                frameBuffer.set([
                  element >> r & 0b11111111,
                  element >> g & 0b11111111,
                  element >> b & 0b11111111,
                  element >> 24 & 0b11111111
                ], index * 4))

              const callback = framebufferRequests.get(JSON.stringify([rectHeader.x, rectHeader.y, rectHeader.width, rectHeader.height]))
              if (callback) callback(frameBuffer)
            }
          }
          break
        case ServerMsg.SetColorMapEntries:
          // TODO: SetColorMapEntries
          console.log("SetColorMapEntries")
          break
        case ServerMsg.Bell:
          onbell()
          break
        case ServerMsg.ServerCutText:
          const lengthBuffer = new Uint8Array(7)
          await connection.read(lengthBuffer)

          const cutTextLength = (lengthBuffer[3] << 24) + (lengthBuffer[4] << 16) + (lengthBuffer[5] << 8) + lengthBuffer[6]
          const cutTextBuffer = new Uint8Array(cutTextLength)
          await connection.read(cutTextBuffer)

          onclipboard(cutTextBuffer)
          break
      }
    } catch (e) {
      if (e.name !== "Interrupted") Promise.reject(e)
    }
  }

  // onconnect is deferred to allow access to properties in return object.
  // It's possible for the connection to close before this is called.
  setTimeout(async () => {
    onconnected()
    while (connectionOpen) await readConnection()
  }, 0)

  return {
    pause,
    pointerEvent,
    pointerDown,
    pointerUp,
    click,
    leftClick,
    rightClick,
    middleClick,
    doubleClick,
    updateClipboard,
    keyEvent,
    keyDown,
    keyUp,
    key,
    type,
    cad,
    end,
    width,
    height,
    name,
    framebufferUpdateRequest,
  }
}