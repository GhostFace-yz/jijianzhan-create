import { api } from './api'
import type { PresignedUrlResponse, ApiResponse } from '@/types'

export async function getPresignedUrl(
  filename: string,
  content_type: string,
  size: number
): Promise<PresignedUrlResponse> {
  const res = await api.post<ApiResponse<PresignedUrlResponse>>(
    '/uploads/presigned-url',
    { filename, content_type, size }
  )
  return res.data.data
}

export async function uploadToOSS(
  uploadUrl: string,
  file: File,
  contentType: string
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
    },
    body: file,
  })

  if (!res.ok) {
    throw new Error(`上传失败: HTTP ${res.status}`)
  }
}

export function uploadToOSSWithProgress(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100)
        onProgress(percent)
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`上传失败: HTTP ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => {
      reject(new Error('上传失败: 网络错误'))
    })

    xhr.addEventListener('abort', () => {
      reject(new Error('上传已取消'))
    })

    xhr.open('PUT', uploadUrl)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.send(file)
  })
}
