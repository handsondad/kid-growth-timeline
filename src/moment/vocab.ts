import type { Block, Moment } from "./types.ts";

/** 时光库里一个瞬间目录下的文件名：两位编号 + 扩展名 */
export const PHOTO_FILE = /^\d{2}\.jpg$/;
export const VIDEO_FILE = /^\d{2}\.mp4$/;
export const posterOf = (video: string) => video.replace(/\.mp4$/, ".poster.jpg");

export type BlockKind = "photos" | "video" | "text" | "said";
export const BLOCK_KINDS: readonly BlockKind[] = ["photos", "video", "text", "said"];

/** 一段是哪一种；一段里只能有一种 */
export function blockKind(block: Block): BlockKind | null {
  const kinds = BLOCK_KINDS.filter((k) => k in block);
  return kinds.length === 1 ? kinds[0] : null;
}

/** 这个瞬间用到的所有媒体文件：照片、视频和视频的封面 */
export function mediaFiles(moment: Pick<Moment, "blocks">): string[] {
  const files: string[] = [];
  for (const b of moment.blocks ?? []) {
    if ("photos" in b && Array.isArray(b.photos)) files.push(...b.photos);
    if ("video" in b && typeof b.video === "string") files.push(b.video, posterOf(b.video));
  }
  return [...new Set(files)];
}

/** 绳子上的缩略图：cover，没写就用第一张照片或第一段视频的封面 */
export function coverFile(moment: Pick<Moment, "blocks" | "cover">): string | undefined {
  if (moment.cover) return moment.cover;
  for (const b of moment.blocks ?? []) {
    if ("photos" in b && b.photos?.length) return b.photos[0];
    if ("video" in b && b.video) return posterOf(b.video);
  }
  return undefined;
}

/** 「4 张照片 · 1 段小视频」 */
export function mediaSummary(moment: Pick<Moment, "blocks">): string {
  let photos = 0;
  let videos = 0;
  for (const b of moment.blocks) {
    if ("photos" in b) photos += b.photos.length;
    if ("video" in b) videos++;
  }
  return [photos && `${photos} 张照片`, videos && `${videos} 段小视频`].filter(Boolean).join(" · ");
}
