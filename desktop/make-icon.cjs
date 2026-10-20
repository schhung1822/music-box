// Tạo build/icon.png (512×512) và build/icon.ico cho electron-builder từ cùng hình vẽ với biểu tượng khay.
// Chạy lại bằng `node desktop/make-icon.cjs` nếu đổi hình trong icon.cjs.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { renderIcon } = require("./icon.cjs");

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
  return Buffer.concat([head, data, crc]);
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0); header.writeUInt32BE(size, 4);
  header[8] = 8; header[9] = 6; // 8 bit, RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ICO chứa các ảnh PNG (Windows Vista trở lên đọc được), đủ cỡ cho thanh tác vụ, Explorer và bộ cài.
function encodeIco(sizes) {
  const images = sizes.map(size => encodePng(size, renderIcon(size)));
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const entry = 6 + 16 * i;
    header[entry] = size >= 256 ? 0 : size; header[entry + 1] = size >= 256 ? 0 : size;
    header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(images[i].length, entry + 8); header.writeUInt32LE(offset, entry + 12);
    offset += images[i].length;
  });
  return Buffer.concat([header, ...images]);
}

const folder = path.join(__dirname, "..", "build");
fs.mkdirSync(folder, { recursive: true });
fs.writeFileSync(path.join(folder, "icon.png"), encodePng(512, renderIcon(512)));
fs.writeFileSync(path.join(folder, "icon.ico"), encodeIco([16, 24, 32, 48, 64, 128, 256]));
console.log("Đã tạo icon.png và icon.ico trong", folder);
