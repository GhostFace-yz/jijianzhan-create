import { IsString, IsNumber, Min, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlDto {
  @ApiProperty({ description: '文件名' })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({ description: 'Content-Type' })
  @IsString()
  @IsNotEmpty()
  content_type: string;

  @ApiProperty({ description: '文件大小（字节）' })
  @IsNumber()
  @Min(1)
  size: number;
}
