import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    PrismaModule,
    AuthModule,
    // TODO: register additional modules here
    // GenerationTasksModule,
    // MessagesModule,
    // SessionsModule,
    // SubscriptionsModule,
    // UploadsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
