import {
  Controller,
  Post,
  Body,
  Put,
  Param,
  Get,
  UseGuards,
  Req,
  Res,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { UploadsService } from './uploads.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';

@ApiTags('Uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: '获取 OSS 预签名上传 URL' })
  getPresignedUrl(@Body() dto: PresignedUrlDto) {
    return this.uploadsService.generatePresignedUrl(
      dto.filename,
      dto.content_type,
      dto.size,
    );
  }

  @Put('local/:key')
  @Public()
  @ApiOperation({ summary: '本地开发环境文件上传（由预签名 URL 触发）' })
  @ApiParam({ name: 'key', description: '文件唯一标识' })
  async uploadLocal(@Param('key') key: string, @Req() req: Request) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const downloadUrl = await this.uploadsService.saveFile(key, buffer);
    return { download_url: downloadUrl };
  }

  @Get(':key')
  @Public()
  @ApiOperation({ summary: '获取上传的文件' })
  @ApiParam({ name: 'key', description: '文件唯一标识' })
  getFile(@Param('key') key: string, @Res() res: Response) {
    const filePath = this.uploadsService.getFilePath(key);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found');
    }
    res.sendFile(filePath);
  }
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
