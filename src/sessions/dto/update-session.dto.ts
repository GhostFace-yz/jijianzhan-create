import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateSessionDto {
  @ApiProperty({ description: '会话标题', example: '重命名后的对话' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title: string;
}
