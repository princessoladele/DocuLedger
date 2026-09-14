import { IsObject, IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class ApproveReviewDto {
  @ApiPropertyOptional({ description: "Field name -> corrected value, merged into the extraction on approval" })
  @IsOptional()
  @IsObject()
  correctedFields?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewerNotes?: string;
}

export class RejectReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewerNotes?: string;
}
