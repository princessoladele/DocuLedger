import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateApiKeyDto {
  @ApiProperty({ example: "CI ingestion key" })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiPropertyOptional({ enum: ["MEMBER", "REVIEWER", "ADMIN"] })
  @IsOptional()
  @IsEnum(["MEMBER", "REVIEWER", "ADMIN"])
  role?: "MEMBER" | "REVIEWER" | "ADMIN";
}
