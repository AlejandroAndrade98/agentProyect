import { IsEmail } from 'class-validator';

export class CreatePlatformOwnerInvitationDto {
  @IsEmail()
  ownerEmail!: string;
}