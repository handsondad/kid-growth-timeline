/**
 * 一个图集 = 一件事 = albums/ 里的一个文件夹：moment.json（这份数据，不含 id）+ 一组照片和小视频，排成一篇图文。
 * 照片是 01.jpg、02.jpg……，视频是 03.mp4 + 封面 03.poster.jpg（npm run album:add 处理好、编好号）。
 * 发布出去的是加密后的 vault/（npm run seal），页面输入密码解开；npm run unseal 能整个解回 albums/。
 */

/** 详情页从上往下的一段 */
export type Block =
  /** 一张，或两三张并排的照片，下面一句说明 */
  | { readonly photos: readonly string[]; readonly caption?: string }
  /** 一段小视频，封面是同名的 .poster.jpg */
  | { readonly video: string; readonly caption?: string }
  /** 大人写的一段话，≤300 字 */
  | { readonly text: string }
  /** 小念的原话，不改字，≤40 字 */
  | { readonly said: string };

export type Moment = {
  /** 目录名，小写字母和短横线；读的时候按目录名填上，moment.json 里不用写 */
  readonly id: string;
  /** 这个图集叫什么，≤12 个字 */
  readonly title: string;
  /** 一句话说那天的事，放在首页预览和详情页开头，≤80 个字 */
  readonly about: string;
  /** 发生的那天。时间绳按这个排 */
  readonly when: {
    /** YYYY-MM-DD */
    readonly date: string;
    /** 那天是什么日子，比如「第一天上学」，≤8 个字 */
    readonly label?: string;
  };
  /** 绳子上的缩略图用哪张（照片或视频封面的文件名）；不写就用第一张 */
  readonly cover?: string;
  readonly blocks: readonly Block[];
  /** 同一天在《小念家的漫画书》里有故事：写那个故事的 id */
  readonly story?: string;
  /** 同一天在《小念的画廊》里有作品：写那件作品的 id */
  readonly work?: string;
};

/** albums/profile.json */
export type Profile = {
  readonly name: string;
  /** 生日 YYYY-MM-DD，用来算「那天几岁」；不写就不显示 */
  readonly birthday?: string;
  /** 年份卡用哪张照片：{ "2025": "first-sea/01.jpg" }；不写就用那一年最后一个图集的封面 */
  readonly covers?: Readonly<Record<string, string>>;
};

/** vault 里一个加密文件 */
export type FileRef = {
  /** vault/blobs/ 下的文件名，随机的样子，看不出是什么 */
  readonly blob: string;
  /** 解开后多少字节 */
  readonly size: number;
  readonly type: string;
  readonly w?: number;
  readonly h?: number;
};

export type SealedMoment = Moment & {
  /** 文件名 → 加密文件 */
  readonly files: Readonly<Record<string, FileRef>>;
  /** 绳子上的小缩略图 */
  readonly thumb?: FileRef;
  /** notes.md：页面不显示，只为了 npm run unseal 换台电脑能解回来 */
  readonly notes?: FileRef;
};

/** vault/index.enc 解开后的样子 */
export type Library = {
  readonly v: 1;
  readonly profile: Profile;
  /** 年份卡的缩略图 */
  readonly years: Readonly<Record<string, FileRef>>;
  readonly moments: readonly SealedMoment[];
};
