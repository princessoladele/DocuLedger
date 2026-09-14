import { IsEmail, IsEnum, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class InviteUserDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ enum: ["MEMBER", "REVIEWER", "ADMIN", "OWNER"] })
  @IsEnum(["MEMBER", "REVIEWER", "ADMIN", "OWNER"])
  role!: "MEMBER" | "REVIEWER" | "ADMIN" | "OWNER";

  /**
   * Temporary invite-time password. Production deployments should replace
   * this with an emailed invite-link + set-password flow (see
   * docs/ARCHITECTURE.md "Future work"); this keeps the vertical slice
   * self-contained without an email provider dependency.
   */
  @ApiProperty()
  @IsString()
  @MinLength(10)
  temporaryPassword!: string;
}
