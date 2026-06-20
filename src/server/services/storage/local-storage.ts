import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageService } from './types.js';

export interface LocalStorageOptions {
  baseDir: string;
  baseUrl: string;
}

/**
 * 本地文件存储实现
 * 将文件复制到 baseDir，并返回 file:// 或自定义 baseUrl 的访问地址。
 */
export class LocalFileStorageService implements StorageService {
  private readonly baseDir: string;
  private readonly baseUrl: string;

  constructor(options: LocalStorageOptions) {
    this.baseDir = path.resolve(options.baseDir);
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
  }

  async save(localPath: string, key: string): Promise<{ url: string } > {
    const destPath = path.join(this.baseDir, key);
    await mkdir(path.dirname(destPath), { recursive: true });
    await copyFile(localPath, destPath);

    if (this.baseUrl.startsWith('file://')) {
      return { url: `file://${destPath}` };
    }

    const normalizedKey = key.replace(/\\/g, '/');
    return { url: `${this.baseUrl}/${normalizedKey}` };
  }
}
