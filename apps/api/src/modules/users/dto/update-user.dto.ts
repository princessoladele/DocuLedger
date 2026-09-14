import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateUserDto {
  @ApiPropertyOptional({ enum: ["MEMBER", "REVIEWER", "ADMIN", "OWNER"] })
  @IsOptional()
  @IsEnum(["MEMBER", "REVIEWER", "ADMIN", "OWNER"])
  role?: "MEMBER" | "REVIEWER" | "ADMIN" | "OWNER";

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
