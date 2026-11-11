// 处理照片：转正、缩到长边 1600、存成 JPEG，顺便去掉拍摄时间、GPS 这些信息。原图不动。
// 给 npm run moment:add 用；也给检查器读 JPEG/PNG 的尺寸和拍摄信息。
//
// 用本机 Edge/Chrome 的画布重画一遍，所以不需要装图像库；手机的 HEIC 先导出成 JPG 再用。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { findBrowser } from "./browser.mjs";

export const PHOTO = {
  /** 长边最多多少像素 */
  maxSide: 2560,
  /** 处理时缩到的长边和 JPEG 质量：手机、平板上看不出差别，一张三五百 KB */
  targetSide: 1600,
  quality: 0.82,
  /** 一张照片最多多大 */
  maxBytes: 2 * 1024 * 1024,
};

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif", ".bmp": "image/bmp" };

/** JPEG / PNG 的尺寸和带没带拍摄信息；认不出来返回 null */
export function inspectPhoto(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    let meta = false;
    let size = null;
    while (i + 4 <= buf.length && buf[i] === 0xff) {
      const marker = buf[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      const len = buf.readUInt16BE(i + 2);
      // APP1 放 Exif / XMP，APP13 放 IPTC：拍摄时间、GPS、相机型号都在这里
      if (marker === 0xe1 || marker === 0xed) meta = true;
      // SOF0～SOF15（除了 DHT、JPG、DAC）里有宽高
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        size = { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
    return size && { type: "jpeg", ...size, meta };
  }
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    let i = 8;
    let meta = false;
    let size = null;
    while (i + 8 <= buf.length) {
      const len = buf.readUInt32BE(i);
      const type = buf.toString("latin1", i + 4, i + 8);
      if (type === "IHDR") size = { width: buf.readUInt32BE(i + 8), height: buf.readUInt32BE(i + 12) };
      if (["eXIf", "tEXt", "iTXt", "zTXt"].includes(type)) meta = true;
      if (type === "IEND") break;
      i += 12 + len;
    }
    return size && { type: "png", ...size, meta };
  }
  return null;
}

/** 返回问题列表，空数组表示这张照片能直接发布 */
export function photoIssues(buf) {
  const info = inspectPhoto(buf);
  if (!info) return ["认不出来，只收 JPEG 或 PNG"];
  const problems = [];
  if (info.meta) problems.push("带着拍摄信息（时间、GPS、相机），删掉后用 npm run moment:add 重新处理");
  if (Math.max(info.width, info.height) > PHOTO.maxSide) problems.push(`${info.width}×${info.height} 太大，长边不超过 ${PHOTO.maxSide}，用 npm run moment:add 处理`);
  if (buf.length > PHOTO.maxBytes) problems.push(`${(buf.length / 1024).toFixed(0)} KB 太大，不超过 ${PHOTO.maxBytes / 1024} KB，用 npm run moment:add 处理`);
  return problems;
}

/** 照片能不能处理：格式不认识或找不到就抛错，返回 MIME 类型 */
export function sourceMime(source) {
  const mime = MIME[extname(source).toLowerCase()];
  if (!mime) throw new Error(`不认识 ${extname(source) || "这种"}文件；手机照片先导出成 JPG`);
  if (!existsSync(source)) throw new Error(`找不到照片：${source}`);
  return mime;
}

/** 处理一张照片，写到 <dir>/<name>，返回写出的文件路径 */
export async function processPhoto(source, { dir, name }) {
  const mime = sourceMime(source);
  const input = `data:${mime};base64,${readFileSync(source).toString("base64")}`;

  const { default: puppeteer } = await import("puppeteer-core");
  const browser = await puppeteer.launch({ executablePath: findBrowser(), headless: true });
  let output;
  try {
    const page = await browser.newPage();
    output = await page.evaluate(async (src, side, quality) => {
      const blob = await (await fetch(src)).blob();
      const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
      const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext("2d");
      // 透明的 PNG 垫白底，不然存成 JPEG 是黑底
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", quality);
    }, input, PHOTO.targetSide, PHOTO.quality);
  } finally {
    await browser.close();
  }

  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, Buffer.from(output.split(",")[1], "base64"));
  return file;
}
