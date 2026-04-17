# 반복 모임 운영 서비스, Moimloop

## 1. pnpm 준비
```bash
cd 프로젝트 루트
npm install --global corepack@latest
corepack enable pnpm
pnpm init
corepack use pnpm@latest-10
```

## 2. 프로젝트 루트 package.json 정리
```json
{
  "name": "moimloop",
  "version": "1.0.0",
  "description": "",
  "private": true,
  "main": "index.js",
  "scripts": {
    "dev:be": "pnpm --filter be start:dev",
    "build:be": "pnpm --filter be build",
    "test:be": "pnpm --filter be test",
    "lint:be": "pnpm --filter be lint"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "packageManager": "pnpm@10.33.0+sha512.10568bb4a6afb58c9eb3630da90cc9516417abebd3fabbe6739f0ae795728da1491e9db5a544c76ad8eb7570f5c4bb3d6c637b2cb41bfdcdb47fa823c8649319"
}
```

## 3. pnpm-workspace.yaml 생성
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

## 4. 백엔드 프로젝트 생성 및 의존성 설치, 패키지 추가
```bash
mkdir -p apps
cd apps
nest new be --skip-git --skip-install --package-manager pnpm
cd ..
pnpm install
pnpm --filter be add @nestjs/config class-validator class-transformer helmet @nestjs/swagger
```

## 5. 백엔드 설정
- apps/be/src/app.module.ts
```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

- apps/be/src/main.ts
```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());

  app.enableCors({
    origin: [process.env.CORS_ORIGIN],
    credentials: true,
  });

  app.setGlobalPrefix('api');

  if (process.env.NODE_ENV !== 'prod') {
    const config = new DocumentBuilder()
      .setTitle('MoimLoop API')
      .setDescription('The MoimLoop API description')
      .setVersion('1.0')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

