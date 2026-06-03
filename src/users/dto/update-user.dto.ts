import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, IsUrl } from 'class-validator';

export class UpdateUserDto {
  @ApiProperty({ description: '用户昵称', required: false, example: '张三' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @ApiProperty({
    description: '头像 URL',
    required: false,
    example: 'https://example.com/avatar.png',
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
