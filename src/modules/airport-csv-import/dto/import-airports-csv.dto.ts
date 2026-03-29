import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const LOCATION_CSV_DATASET_TYPES = [
  'auto',
  'countries',
  'regions',
  'airports',
] as const;

export type LocationCsvDatasetType =
  (typeof LOCATION_CSV_DATASET_TYPES)[number];

export class ImportAirportsCsvDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  filename?: string;

  @IsOptional()
  @IsIn(LOCATION_CSV_DATASET_TYPES)
  datasetType?: LocationCsvDatasetType;

  @IsOptional()
  @IsString()
  @MaxLength(20_000_000)
  csvContent?: string;
}
