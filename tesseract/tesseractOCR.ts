
import * as TCore from 'npm:tesseract.js-core';
import { Encoder } from "https://deno.land/x/bitmap/mod.ts";
const TesseractCore = await TCore.default;
import { createRequire } from "https://deno.land/std@0.120.0/node/module.ts";
const require = createRequire(import.meta.url);
const dump = require('./dump');
const setImage = require('./setImage');

const PSM = {
  OSD_ONLY: '0',
  AUTO_OSD: '1',
  AUTO_ONLY: '2',
  AUTO: '3',
  SINGLE_COLUMN: '4',
  SINGLE_BLOCK_VERT_TEXT: '5',
  SINGLE_BLOCK: '6',
  SINGLE_LINE: '7',
  SINGLE_WORD: '8',
  CIRCLE_WORD: '9',
  SINGLE_CHAR: '10',
  SPARSE_TEXT: '11',
  SPARSE_TEXT_OSD: '12',
  RAW_LINE: '13',
}

const defaultParams: any = {
  tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
  tessedit_char_whitelist: '',
  tessjs_create_hocr: '1',
  tessjs_create_tsv: '1',
  tessjs_create_box: '0',
  tessjs_create_unlv: '0',
  tessjs_create_osd: '0',
}

export const ocr = async (imageBuffer: Uint8Array, width: number, height: number, language = "eng") => {

  // TODO: parameratize oem
  const oem = 3; // DEFAULT
  const TessModule = await TesseractCore();
  const api = new TessModule.TessBaseAPI();

  // TODO: Dynamically load languages/ support other languages.
  const langData = await Deno.readFile("./eng.traineddata");
  TessModule.FS.writeFile(`./eng.traineddata`, langData);
  const status = api.Init(null, language, oem);
  if (status === -1) Promise.reject('initialization failed');

  Object.keys(defaultParams)
    .filter((k) => !k.startsWith('tessjs_'))
    .forEach((key) => {
      api.SetVariable(key, defaultParams[key]);
    });

  const bitmap = Encoder({
    data: Buffer.from(imageBuffer),
    width,
    height
  });

  const ptr = setImage(TessModule, api, bitmap.data);
  // api.SetRectangle(rec.left, rec.top, rec.width, rec.height);
  await api.Recognize(null);
  const result = await dump(TessModule, api, defaultParams)
  TessModule._free(ptr); // Clean up memory
  return result;
}