import { IsString, MaxLength, MinLength } from 'class-validator';

/** A chat message typed into the #it-help channel. */
export class CreateBrainMessageDto {
  /**
   * Which employee the message is posted as. The demo lets the presenter
   * pick, so this is a name rather than the signed-in user.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  authorName: string;

  @IsString()
  @MinLength(1, { message: 'Message cannot be empty' })
  @MaxLength(2000)
  text: string;
}
