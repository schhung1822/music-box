// Biểu tượng vẽ bằng mã, nên không cần tệp ảnh đi kèm: dùng cho khay hệ thống và (qua make-icon.cjs) cho tệp cài đặt.
// Hình đĩa nhạc theo tông xanh rêu của giao diện; bản "recording" thêm chấm đỏ ở góc.

const clamp = value => Math.min(1, Math.max(0, value));
// Độ phủ của một hình theo khoảng cách có dấu (điểm ảnh), làm mịn viền khoảng một điểm ảnh.
const cover = distance => clamp(.5 - distance);

function roundedBoxDistance(x, y, half, radius) {
  const qx = Math.abs(x) - (half - radius);
  const qy = Math.abs(y) - (half - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Trả về RGBA 8 bit, không nhân trước độ trong suốt. */
function renderIcon(size, { recording = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const unit = size / 100;
  const layers = [
    // [hàm khoảng cách theo toạ độ lấy tâm làm gốc, màu]
    [(x, y) => roundedBoxDistance(x, y, size / 2, size * .22), [23, 32, 25]],
    [(x, y) => Math.hypot(x, y) - 38 * unit, [111, 143, 99]],
    [(x, y) => Math.hypot(x, y) - 30 * unit, [34, 52, 40]],
    [(x, y) => Math.hypot(x, y) - 22 * unit, [207, 220, 189]],
    [(x, y) => Math.hypot(x, y) - 7 * unit, [23, 32, 25]],
  ];
  if (recording) {
    layers.push([(x, y) => Math.hypot(x - 27 * unit, y + 27 * unit) - 21 * unit, [23, 32, 25]]);
    layers.push([(x, y) => Math.hypot(x - 27 * unit, y + 27 * unit) - 15 * unit, [229, 72, 77]]);
  }
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = px + .5 - size / 2;
      const y = py + .5 - size / 2;
      let r = 0, g = 0, b = 0, a = 0;
      for (const [distance, color] of layers) {
        const alpha = cover(distance(x, y));
        if (alpha <= 0) continue;
        // Chồng lớp mới lên trên: over(màu mới, kết quả cũ).
        const out = alpha + a * (1 - alpha);
        r = (color[0] * alpha + r * a * (1 - alpha)) / out;
        g = (color[1] * alpha + g * a * (1 - alpha)) / out;
        b = (color[2] * alpha + b * a * (1 - alpha)) / out;
        a = out;
      }
      const i = (py * size + px) * 4;
      pixels[i] = Math.round(r); pixels[i + 1] = Math.round(g); pixels[i + 2] = Math.round(b); pixels[i + 3] = Math.round(a * 255);
    }
  }
  return pixels;
}

/** Electron nhận bitmap BGRA đã nhân trước độ trong suốt. */
function toBitmap(rgba) {
  const bitmap = Buffer.alloc(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const alpha = rgba[i + 3] / 255;
    bitmap[i] = Math.round(rgba[i + 2] * alpha);
    bitmap[i + 1] = Math.round(rgba[i + 1] * alpha);
    bitmap[i + 2] = Math.round(rgba[i] * alpha);
    bitmap[i + 3] = rgba[i + 3];
  }
  return bitmap;
}

module.exports = { renderIcon, toBitmap };
