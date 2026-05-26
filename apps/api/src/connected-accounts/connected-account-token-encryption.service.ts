import { InternalServerErrorException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const AUTH_TAG_LENGTH_BYTES = 16;
const KEY_LENGTH_BYTES = 32;

@Injectable()
export class ConnectedAccountTokenEncryptionService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(plainText: string): string {
    if (!plainText) {
      throw new InternalServerErrorException(
        'Cannot encrypt an empty connected account token',
      );
    }

    const key = this.getEncryptionKey();
    const version = this.getEncryptionVersion();
    const iv = randomBytes(IV_LENGTH_BYTES);

    const cipher = createCipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });

    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [
      version,
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join(':');
  }

  decrypt(encryptedPayload: string): string {
    const [version, ivBase64, authTagBase64, encryptedBase64] =
      encryptedPayload.split(':');

    if (!version || !ivBase64 || !authTagBase64 || !encryptedBase64) {
      throw new InternalServerErrorException(
        'Invalid connected account encrypted token payload',
      );
    }

    if (version !== this.getEncryptionVersion()) {
      throw new InternalServerErrorException(
        'Unsupported connected account token encryption version',
      );
    }

    const key = this.getEncryptionKey();
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const encrypted = Buffer.from(encryptedBase64, 'base64');

    const decipher = createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: AUTH_TAG_LENGTH_BYTES,
    });

    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  getEncryptionVersion(): string {
    return (
      this.configService.get<string>(
        'app.connectedAccountTokenEncryptionVersion',
      ) || 'v1'
    );
  }

  private getEncryptionKey(): Buffer {
    const keyBase64 = this.configService.get<string>(
      'app.connectedAccountTokenEncryptionKey',
    );

    if (!keyBase64) {
      throw new InternalServerErrorException(
        'Connected account token encryption key is missing',
      );
    }

    const key = Buffer.from(keyBase64, 'base64');

    if (key.length !== KEY_LENGTH_BYTES) {
      throw new InternalServerErrorException(
        'Connected account token encryption key must be 32 bytes in base64',
      );
    }

    return key;
  }
}