const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePng(size) {
  const bg = { r: 7, g: 94, b: 84 };
  const fg = { r: 255, g: 255, b: 255 };
  const raw = Buffer.alloc(size * (1 + size * 3));

  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 3);
    raw[row] = 0;
    for (let x = 0; x < size; x++) {
      const i = row + 1 + x * 3;
      raw[i] = bg.r;
      raw[i + 1] = bg.g;
      raw[i + 2] = bg.b;
    }
  }

  const pad = Math.round(size * 0.18);
  const left = pad;
  const right = size - 1 - pad;
  const top = Math.round(size * 0.28);
  const bottom = size - 1 - pad;
  const mid = Math.floor(size / 2);
  const stroke = Math.max(10, Math.round(size * 0.08));

  const setPixel = (x, y) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = y * (1 + size * 3) + 1 + x * 3;
    raw[i] = fg.r;
    raw[i + 1] = fg.g;
    raw[i + 2] = fg.b;
  };

  const drawLine = (x0, y0, x1, y1) => {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + (dx * s) / steps);
      const y = Math.round(y0 + (dy * s) / steps);
      for (let ox = -Math.floor(stroke / 2); ox <= Math.floor(stroke / 2); ox++) {
        for (let oy = -Math.floor(stroke / 2); oy <= Math.floor(stroke / 2); oy++) {
          setPixel(x + ox, y + oy);
        }
      }
    }
  };

  drawLine(left, top, left + Math.round((right - left) * 0.28), bottom);
  drawLine(left + Math.round((right - left) * 0.28), bottom, mid, top + Math.round((bottom - top) * 0.35));
  drawLine(mid, top + Math.round((bottom - top) * 0.35), right - Math.round((right - left) * 0.28), bottom);
  drawLine(right - Math.round((right - left) * 0.28), bottom, right, top);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const dir = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "icon-192.png"), makePng(192));
fs.writeFileSync(path.join(dir, "icon-512.png"), makePng(512));
console.log("wrote icon-192.png and icon-512.png");
