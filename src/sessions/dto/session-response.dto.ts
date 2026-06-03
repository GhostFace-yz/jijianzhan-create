import { ApiProperty } from '@nestjs/swagger';

class MessageSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;
}

export class SessionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ required: false })
  deletedAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: [MessageSummaryDto], required: false })
  messages?: MessageSummaryDto[];
}

export class SessionListResponseDto {
  @ApiProperty({ type: [SessionResponseDto] })
  items: SessionResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
