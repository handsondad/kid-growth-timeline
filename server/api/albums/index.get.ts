import { asc, desc, eq } from 'drizzle-orm'

export default eventHandler(async (event) => {
  const db = useDB()
  // Fetch all albums ordered by position asc (createdAt desc as secondary sort)
  const albums = await db
    .select()
    .from(tables.albums)
    .orderBy(asc(tables.albums.position), desc(tables.albums.createdAt))

  // 为每个相册获取照片 ID 列表（避免循环引用）
  const albumsWithPhotoIds = await Promise.all(
    albums.map(async (album) => {
      const photoIds = await db
        .select({
          photoId: tables.albumPhotos.photoId,
          position: tables.albumPhotos.position,
        })
        .from(tables.albumPhotos)
        .where(eq(tables.albumPhotos.albumId, album.id))
        .orderBy(tables.albumPhotos.position)

      const { passwordHash: _passwordHash, ...safeAlbum } = album
      return {
        ...safeAlbum,
        photoIds: photoIds.map((photo) => photo.photoId),
      }
    }),
  )

  // Already ordered by position asc at the SQL layer
  return albumsWithPhotoIds
})
