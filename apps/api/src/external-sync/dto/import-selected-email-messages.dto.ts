import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsString,
  MaxLength,
} from 'class-validator';

export class ImportSelectedEmailMessagesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(25)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  providerMessageIds!: string[];
}
