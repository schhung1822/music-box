// electron-builder chỉnh biểu tượng và thông tin tệp .exe qua gói winCodeSign, mà gói đó giải nén thất bại trên
// Windows không bật Developer Mode (lỗi tạo symlink). Vì vậy tắt bước đó (signAndEditExecutable: false)
// và tự làm phần cần thiết bằng rcedit.
const path = require("node:path");
const rcedit = require("rcedit");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") return;
  const { productFilename, productName } = context.packager.appInfo;
  const exe = path.join(context.appOutDir, `${productFilename}.exe`);
  await rcedit(exe, {
    icon: path.join(context.packager.projectDir, "build", "icon.ico"),
    "version-string": { ProductName: productName, FileDescription: productName },
  });
};
