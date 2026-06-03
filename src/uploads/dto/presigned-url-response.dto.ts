import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlResponseDto {
  @ApiProperty({ description: '用于上传的预签名 URL' })
  upload_url: string;

  @ApiProperty({ description: '上传后用于访问的下载 URL' })
  download_url: string;

  @ApiProperty({ description: '文件唯一标识' })
  key: string;
}
