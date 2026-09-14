import { IsArray, IsEnum, IsNumber, IsOptional, IsString, Max, Min, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FieldDefinition } from "@doculedger/shared";

export class CreateSchemaDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  key!: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ enum: ["REAL_ESTATE", "HEALTHCARE", "FINANCE", "LOGISTICS", "COMPLIANCE", "GENERAL"] })
  @IsEnum(["REAL_ESTATE", "HEALTHCARE", "FINANCE", "LOGISTICS", "COMPLIANCE", "GENERAL"])
  industry!: "REAL_ESTATE" | "HEALTHCARE" | "FINANCE" | "LOGISTICS" | "COMPLIANCE" | "GENERAL";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidenceThreshold?: number;

  @ApiProperty({ type: "array", description: "FieldDefinition[] — see packages/shared/src/schema-types.ts" })
  @IsArray()
  fields!: FieldDefinition[];
}
