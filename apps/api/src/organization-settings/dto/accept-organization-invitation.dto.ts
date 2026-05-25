import { IsString, MinLength } from 'class-validator';

export class AcceptOrganizationInvitationDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}