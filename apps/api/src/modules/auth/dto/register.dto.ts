import { IsEmail, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({ example: "Acme Title Co." })
  @IsString()
  @MinLength(2)
  organizationName!: string;

  @ApiProperty({ example: "founder@acme.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Jordan Rivera" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ example: "correct-horse-battery-staple", minLength: 10 })
  @IsString()
  @MinLength(10, { message: "Password must be at least 10 characters" })
  password!: string;
}
