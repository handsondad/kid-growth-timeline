import type { WorkerPool } from '../../server/services/pipeline-queue'
import type { Photo as StoredPhoto } from '../../server/utils/db'

declare global {
  var __workerPool: WorkerPool | undefined
  interface Photo extends StoredPhoto {
    fileName?: string | null
  }
}

export {}
