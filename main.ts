import { createConnection, MouseButton, Key } from "./denovnc.ts";

const host = '192.168.1.240';
const port = 5900;
const password = 'secret';

const client = await createConnection({
  host, port, password,
  onerror: (error: any) => {
    throw new Error(error);
  },
  onclose: () => {
    console.log("Connection closed.");
  },
  onconnected: () => {
    console.log('Successfully connected and authorised.');
    console.log(`Remote screen name: ${client.name} Width: ${client.width()} Height: ${client.height()}`);
    // console.log(`Remote screen name: ${client.title} Width: ${client.width} Height: ${client.height}`);
  },
  onresize: () => {
    // console.log(`Window size has been resized! Width: ${client.width}, Height: ${client.height}`);
    console.log(`Window size has been resized! Width: ${client.width()}, Height: ${client.height()}`);
  },
  onclipboard: (newPasteBufData: any) => {
    console.log('Remote clipboard updated!', newPasteBufData);
  },
  onbell: () => {
    console.log('Bell!');
  },
});

const routine1 = async (client: any) => {
  const { text, capture } = await client.read(400, 400, 600, 450); // request & wait for update, then OCR rect
  switch (text.toLowerCase()) {
    case "ready":
      await client.click(425, 425);   // same as leftclick, mouse down, then mouse up
      break;
    case "loading":
      await client.rightclick(425, 425); // mouse down, then mouse up
      await client.leftclick(450, 450);  // same as click
      break;
    default:
      console.log("Unknown text from routine1: ", text, capture);
  }
}
const drawSinWave = async (client: any) => {
  const a = 150;
  const b = -0.2;
  for (let step = 0; step < 111; step++) {
    await client.pointerDown(400 + step * 10, 750 + (Math.sin(step  * b ) * a));
  }
  await client.pointerUp(1500, 750);
}

await client.framebufferUpdateRequest(20, 20, 140, 70);

await client.updateClipboard('Hello from deno!'); // update server clipboard
// await client.pause(1000);               // timeout helper
// await client.pointerDown(600, 600);    // x, y, button state (bit mask for each mouse button)
// await client.pointerUp(600, 600);    // x, y, button state (bit mask for each mouse button)

// await client.click(800, 800);       // x, y - same as leftclick unless button number specified
// await client.doubleClick(100, 100); // x, y - two clicks, 100ms apart
// await client.leftClick(100, 100);   // x, y
// await client.rightClick(300, 400);  // x, y
// await client.middleClick(100, 100); // x, y
// await client.keyDown(Key.Shift);     // keycode
// await client.key(44);         // keycode - sends keydown, then keyup
// await client.key('4');         // keycode - sends keydown, then keyup
// await client.keyUp(Key.Shift);       // keycode
// await client.type("Hello!");  // sends key events
// await client.key('s', Key.Shift, Key.Control);         // keycode - sends keydown, then keyup
// await client.cad();           // sends control + alt + delete

// await routine1(client);   // call a routine within a regular flow
// await routine1(client);   // call a routine within a regular flow

// const { text } = await client.read(400, 400, 600, 450);       // request & wait for update, then OCR rect
// const { capture } = await client.capture(400, 400, 600, 450); // request & wait for update
// const color = await client.sampleColor(700, 600);             // returns the hex color at x,y

// await client.matchIcon(700, 600, 'path/to/icon.png')  // request & wait for update, then try to match icon
//   ? await client.middleClick(100, 100)
//   : console.log("The icon does not match!");

// await client.matchText(200, 100, 'username')  // request & wait for update, then ocr & try to match text
//   ? await client.click(100, 100)
//   : console.log("The icon does not match!");

await client.end(); // close connection