import assert from "node:assert/strict";
import { test } from "node:test";
import { inspectPhoto, photoIssues, PHOTO } from "../tools/photo.mjs";

const seg = (marker, body) => {
  const head = Buffer.alloc(4);
  head.writeUInt16BE(0xff00 | marker, 0);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
};
const sof = (width, height) => {
  const b = Buffer.alloc(6);
  b[0] = 8;
  b.writeUInt16BE(height, 1);
  b.writeUInt16BE(width, 3);
  return seg(0xc0, b);
};
const jpeg = (...segments) => Buffer.concat([Buffer.from([0xff, 0xd8]), ...segments, Buffer.from([0xff, 0xda, 0, 2, 0xff, 0xd9])]);
const app0 = seg(0xe0, Buffer.from("JFIF\0\x01\x01\0\0\x01\0\x01\0\0", "latin1"));
const exif = seg(0xe1, Buffer.from("Exif\0\0MM\0*", "latin1"));

test("读得出 JPEG 的宽高", () => {
  assert.deepEqual(inspectPhoto(jpeg(app0, sof(1600, 1200))), { type: "jpeg", width: 1600, height: 1200, meta: false });
});

test("带 Exif 的照片不能直接发布", () => {
  const problems = photoIssues(jpeg(app0, exif, sof(800, 600)));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /拍摄信息/);
});

test("太大的照片不能直接发布", () => {
  assert.match(photoIssues(jpeg(app0, sof(PHOTO.maxSide + 1, 100))).join(), /太大/);
});

test("干净的 JPEG 能发布，认不出的文件不行", () => {
  assert.deepEqual(photoIssues(jpeg(app0, sof(1200, 900))), []);
  assert.match(photoIssues(Buffer.from("GIF89a")).join(), /认不出来/);
});
