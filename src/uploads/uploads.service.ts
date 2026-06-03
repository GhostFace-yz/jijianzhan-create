import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadsService {
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    const port = this.configService.get('PORT') ?? '3000';
    this.baseUrl = this.configService.get('BASE_URL') ?? `http://localhost:${port}`;
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  generatePresignedUrl(filename: string, _contentType: string, _size: number) {
    const ext = path.extname(filename) || '.bin';
    const key = `${randomUUID()}${ext}`;
    const uploadUrl = `${this.baseUrl}/uploads/local/${key}`;
    const downloadUrl = `${this.baseUrl}/uploads/${key}`;

    return {
      upload_url: uploadUrl,
      download_url: downloadUrl,
      key,
    };
  }

  async saveFile(key: string, buffer: Buffer): Promise<string> {
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, buffer);
    return `${this.baseUrl}/uploads/${key}`;
  }

  getFilePath(key: string): string {
    return path.join(this.uploadDir, key);
  }
}
