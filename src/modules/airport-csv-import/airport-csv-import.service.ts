import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { LocationAirport } from '../locations/entities/location-airport.entity';
import { LocationCity } from '../locations/entities/location-city.entity';
import { LocationCountryRef } from '../locations/entities/location-country-ref.entity';
import {
  LocationNameI18n,
  LocationProvince,
} from '../locations/entities/location-province.entity';
import { LocationRegionRef } from '../locations/entities/location-region-ref.entity';
import { LocationCsvDatasetType } from './dto/import-airports-csv.dto';

type DetectedDatasetType = 'countries' | 'regions' | 'airports';

interface ImportErrorItem {
  row: number;
  reason: string;
}

interface ImportCsvInput {
  filename?: string;
  datasetType?: LocationCsvDatasetType;
  csvContent: string;
}

interface ParsedCountryRow {
  rowNumber: number;
  code: string;
  name: string;
  nameI18n: LocationNameI18n;
  continent: string | null;
}

interface ParsedRegionRow {
  rowNumber: number;
  code: string;
  localCode: string | null;
  name: string;
  nameI18n: LocationNameI18n;
  continent: string | null;
  isoCountry: string;
}

interface ParsedAirportRow {
  rowNumber: number;
  airportCode: string;
  name: string;
  nameI18n: LocationNameI18n;
  type: string;
  scheduledService: 'yes' | 'no' | '';
  isoCountry: string;
  isoRegion: string;
  municipality: string;
  municipalityI18n: LocationNameI18n;
  provinceI18n: LocationNameI18n | null;
  latitude: number | null;
  longitude: number | null;
}

interface ParseResult<T> {
  totalRows: number;
  rows: T[];
  skipped: number;
  errors: ImportErrorItem[];
}

export interface AirportCsvImportResult {
  datasetType: DetectedDatasetType;
  filename: string | null;
  totalRows: number;
  validRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ImportErrorItem[];
}

@Injectable()
export class AirportCsvImportService {
  private static readonly ALLOWED_COUNTRY_CODES = new Set(['CN', 'MN']);
  private static readonly ALLOWED_IATA_CODES = new Set(['ULN', 'UBN']);

  private static readonly CN_REGION_CODE_TO_NAME: Record<string, string> = {
    BJ: 'Beijing',
    TJ: 'Tianjin',
    HE: 'Hebei',
    SX: 'Shanxi',
    NM: 'Inner Mongolia',
    LN: 'Liaoning',
    JL: 'Jilin',
    HL: 'Heilongjiang',
    SH: 'Shanghai',
    JS: 'Jiangsu',
    ZJ: 'Zhejiang',
    AH: 'Anhui',
    FJ: 'Fujian',
    JX: 'Jiangxi',
    SD: 'Shandong',
    HA: 'Henan',
    HB: 'Hubei',
    HN: 'Hunan',
    GD: 'Guangdong',
    GX: 'Guangxi',
    HI: 'Hainan',
    CQ: 'Chongqing',
    SC: 'Sichuan',
    GZ: 'Guizhou',
    YN: 'Yunnan',
    XZ: 'Xizang',
    SN: 'Shaanxi',
    GS: 'Gansu',
    QH: 'Qinghai',
    NX: 'Ningxia',
    XJ: 'Xinjiang',
    HK: 'Hong Kong',
    MO: 'Macao',
    TW: 'Taiwan',
  };

  constructor(private readonly dataSource: DataSource) {}

  async importFromCsv(input: ImportCsvInput): Promise<AirportCsvImportResult> {
    const csvRows = this.parseCsvRows(input.csvContent);
    if (csvRows.length === 0) {
      throw new BadRequestException({
        code: 'LOCATION_CSV_EMPTY',
        message: 'CSV is empty.',
      });
    }

    const header = csvRows[0] ?? [];
    const datasetType = this.detectDatasetType(
      input.datasetType ?? 'auto',
      header,
    );

    if (datasetType === 'countries') {
      return this.importCountriesCsv(csvRows, input.filename);
    }
    if (datasetType === 'regions') {
      return this.importRegionsCsv(csvRows, input.filename);
    }
    return this.importAirportsCsv(csvRows, input.filename);
  }

  private async importCountriesCsv(
    csvRows: string[][],
    filename?: string,
  ): Promise<AirportCsvImportResult> {
    const parsed = this.parseCountriesCsv(csvRows);
    if (parsed.rows.length === 0) {
      throw new BadRequestException({
        code: 'LOCATION_CSV_NO_VALID_COUNTRIES',
        message: 'CSV does not contain any valid country rows.',
        details: parsed.errors.slice(0, 20),
      });
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const countryRepo = manager.getRepository(LocationCountryRef);
      const codes = [...new Set(parsed.rows.map((row) => row.code))];
      const existing = await countryRepo.find({ where: { code: In(codes) } });
      const existingByCode = new Map(
        existing.map((item) => [item.code, item] as const),
      );

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const rowErrors: ImportErrorItem[] = [...parsed.errors];

      for (const row of parsed.rows) {
        try {
          const found = existingByCode.get(row.code);
          if (found) {
            found.name = row.name;
            found.nameI18n = row.nameI18n;
            found.continent = row.continent;
            await countryRepo.save(found);
            updated += 1;
          } else {
            const createdItem = countryRepo.create({
              code: row.code,
              name: row.name,
              nameI18n: row.nameI18n,
              continent: row.continent,
            });
            const saved = await countryRepo.save(createdItem);
            existingByCode.set(saved.code, saved);
            created += 1;
          }
        } catch (error) {
          skipped += 1;
          rowErrors.push({
            row: row.rowNumber,
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        created,
        updated,
        skipped,
        errors: rowErrors,
      };
    });

    return {
      datasetType: 'countries',
      filename: filename?.trim() || null,
      totalRows: parsed.totalRows,
      validRows: parsed.rows.length,
      created: result.created,
      updated: result.updated,
      skipped: parsed.skipped + result.skipped,
      errors: result.errors.slice(0, 100),
    };
  }

  private async importRegionsCsv(
    csvRows: string[][],
    filename?: string,
  ): Promise<AirportCsvImportResult> {
    const parsed = this.parseRegionsCsv(csvRows);
    if (parsed.rows.length === 0) {
      throw new BadRequestException({
        code: 'LOCATION_CSV_NO_VALID_REGIONS',
        message: 'CSV does not contain any valid region rows.',
        details: parsed.errors.slice(0, 20),
      });
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const countryRepo = manager.getRepository(LocationCountryRef);
      const regionRepo = manager.getRepository(LocationRegionRef);

      const countryCodes = [
        ...new Set(parsed.rows.map((row) => row.isoCountry)),
      ];
      const existingCountries = await countryRepo.find({
        where: { code: In(countryCodes) },
      });
      const countryByCode = new Map(
        existingCountries.map((item) => [item.code, item] as const),
      );

      for (const code of countryCodes) {
        if (countryByCode.has(code)) continue;
        const createdCountry = await countryRepo.save(
          countryRepo.create({
            code,
            name: code,
            nameI18n: this.buildFallbackNameI18n(code),
            continent: null,
          }),
        );
        countryByCode.set(code, createdCountry);
      }

      const regionCodes = [...new Set(parsed.rows.map((row) => row.code))];
      const existingRegions = await regionRepo.find({
        where: { code: In(regionCodes) },
      });
      const regionByCode = new Map(
        existingRegions.map((item) => [item.code, item] as const),
      );

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const rowErrors: ImportErrorItem[] = [...parsed.errors];

      for (const row of parsed.rows) {
        try {
          const found = regionByCode.get(row.code);
          if (found) {
            found.localCode = row.localCode;
            found.name = row.name;
            found.nameI18n = row.nameI18n;
            found.continent = row.continent;
            found.isoCountry = row.isoCountry;
            await regionRepo.save(found);
            updated += 1;
          } else {
            const createdItem = regionRepo.create({
              code: row.code,
              localCode: row.localCode,
              name: row.name,
              nameI18n: row.nameI18n,
              continent: row.continent,
              isoCountry: row.isoCountry,
            });
            const saved = await regionRepo.save(createdItem);
            regionByCode.set(saved.code, saved);
            created += 1;
          }
        } catch (error) {
          skipped += 1;
          rowErrors.push({
            row: row.rowNumber,
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        created,
        updated,
        skipped,
        errors: rowErrors,
      };
    });

    return {
      datasetType: 'regions',
      filename: filename?.trim() || null,
      totalRows: parsed.totalRows,
      validRows: parsed.rows.length,
      created: result.created,
      updated: result.updated,
      skipped: parsed.skipped + result.skipped,
      errors: result.errors.slice(0, 100),
    };
  }

  private async importAirportsCsv(
    csvRows: string[][],
    filename?: string,
  ): Promise<AirportCsvImportResult> {
    const parsed = this.parseAirportsCsv(csvRows);
    if (parsed.rows.length === 0) {
      throw new BadRequestException({
        code: 'LOCATION_CSV_NO_VALID_AIRPORTS',
        message: 'CSV does not contain any valid airport rows.',
        details: parsed.errors.slice(0, 20),
      });
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const airportRepo = manager.getRepository(LocationAirport);
      const regionRepo = manager.getRepository(LocationRegionRef);

      const airportCodes = [
        ...new Set(parsed.rows.map((row) => row.airportCode)),
      ];
      const existingAirports = await airportRepo.find({
        where: { airportCode: In(airportCodes) },
      });
      const existingAirportByCode = new Map(
        existingAirports.map((item) => [item.airportCode, item] as const),
      );

      const regionCodes = [
        ...new Set(parsed.rows.map((row) => row.isoRegion).filter(Boolean)),
      ];
      const regionItems =
        regionCodes.length > 0
          ? await regionRepo.find({ where: { code: In(regionCodes) } })
          : [];
      const regionByCode = new Map(
        regionItems.map((item) => [item.code, item] as const),
      );

      const provinceCache = new Map<string, LocationProvince>();
      const cityCache = new Map<string, LocationCity>();

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const rowErrors: ImportErrorItem[] = [...parsed.errors];

      for (const row of parsed.rows) {
        try {
          const province = this.resolveProvinceInfo(
            row.isoCountry,
            row.isoRegion,
            regionByCode,
            row.provinceI18n,
          );
          const cityName = row.municipality || province.name;
          const cityI18n = row.municipality
            ? row.municipalityI18n
            : province.nameI18n;
          const city = await this.upsertProvinceCity(
            manager,
            row.isoCountry,
            province.name,
            province.nameI18n,
            cityName,
            cityI18n,
            provinceCache,
            cityCache,
          );

          const existingAirport = existingAirportByCode.get(row.airportCode);
          const nextName =
            row.name ||
            existingAirport?.nameI18n?.['en-US']?.trim() ||
            existingAirport?.name ||
            row.airportCode;

          const nextI18n = this.mergeNameI18n(
            existingAirport?.nameI18n ?? null,
            row.nameI18n,
            nextName,
          );

          if (existingAirport) {
            existingAirport.cityId = city.id;
            existingAirport.name = nextName;
            existingAirport.nameI18n = nextI18n;
            if (row.latitude !== null && row.longitude !== null) {
              existingAirport.latitude = row.latitude;
              existingAirport.longitude = row.longitude;
            }
            await airportRepo.save(existingAirport);
            updated += 1;
          } else {
            const createdAirport = airportRepo.create({
              cityId: city.id,
              airportCode: row.airportCode,
              name: nextName,
              nameI18n: nextI18n,
              latitude: row.latitude,
              longitude: row.longitude,
            });
            const savedAirport = await airportRepo.save(createdAirport);
            existingAirportByCode.set(savedAirport.airportCode, savedAirport);
            created += 1;
          }
        } catch (error) {
          skipped += 1;
          rowErrors.push({
            row: row.rowNumber,
            reason: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      return {
        created,
        updated,
        skipped,
        errors: rowErrors,
      };
    });

    return {
      datasetType: 'airports',
      filename: filename?.trim() || null,
      totalRows: parsed.totalRows,
      validRows: parsed.rows.length,
      created: result.created,
      updated: result.updated,
      skipped: parsed.skipped + result.skipped,
      errors: result.errors.slice(0, 100),
    };
  }

  private async upsertProvinceCity(
    manager: EntityManager,
    countryCode: string,
    provinceName: string,
    provinceI18n: LocationNameI18n,
    cityName: string,
    cityI18n: LocationNameI18n,
    provinceCache: Map<string, LocationProvince>,
    cityCache: Map<string, LocationCity>,
  ): Promise<LocationCity> {
    const provinceRepo = manager.getRepository(LocationProvince);
    const cityRepo = manager.getRepository(LocationCity);

    const provinceKey = `${countryCode}|${provinceName}`.toLowerCase();
    let province: LocationProvince | null =
      provinceCache.get(provinceKey) ?? null;
    if (!province) {
      province = await provinceRepo.findOne({
        where: { country: countryCode, name: provinceName },
      });
      if (!province) {
        province = await provinceRepo.save(
          provinceRepo.create({
            country: countryCode,
            name: provinceName,
            nameI18n: provinceI18n,
          }),
        );
      } else {
        province.nameI18n = this.mergeNameI18n(
          province.nameI18n,
          provinceI18n,
          provinceName,
        );
        province = await provinceRepo.save(province);
      }
      provinceCache.set(provinceKey, province);
    }

    const cityKey = `${province.id}|${cityName}`.toLowerCase();
    let city: LocationCity | null = cityCache.get(cityKey) ?? null;
    if (!city) {
      city = await cityRepo.findOne({
        where: { provinceId: province.id, name: cityName },
      });
      if (!city) {
        city = await cityRepo.save(
          cityRepo.create({
            provinceId: province.id,
            name: cityName,
            nameI18n: cityI18n,
          }),
        );
      } else {
        city.nameI18n = this.mergeNameI18n(city.nameI18n, cityI18n, cityName);
        city = await cityRepo.save(city);
      }
      cityCache.set(cityKey, city);
    }

    return city;
  }

  private mergeNameI18n(
    current: Record<string, string | undefined> | null | undefined,
    incoming: Record<string, string | undefined> | null | undefined,
    fallbackEn: string,
  ): LocationNameI18n {
    const currentEn = this.normalizeI18nValue(current?.['en-US']);
    const incomingEn = this.normalizeI18nValue(incoming?.['en-US']);
    const en = incomingEn || currentEn || fallbackEn.trim();

    const currentZh = this.normalizeI18nValue(current?.['zh-CN']);
    const incomingZh = this.normalizeI18nValue(incoming?.['zh-CN']);
    const zh = incomingZh || currentZh || en;

    const currentMn = this.normalizeI18nValue(current?.['mn-MN']);
    const incomingMn = this.normalizeI18nValue(incoming?.['mn-MN']);
    const mn = incomingMn || currentMn || en;

    return {
      'zh-CN': zh,
      'en-US': en,
      'mn-MN': mn,
    };
  }

  private normalizeI18nValue(raw: string | undefined): string {
    if (typeof raw !== 'string') return '';
    return raw.trim();
  }

  private buildFallbackNameI18n(enName: string): LocationNameI18n {
    const en = enName.trim();
    return {
      'zh-CN': en,
      'en-US': en,
      'mn-MN': en,
    };
  }

  private pickNameI18nIndexes(
    headerIndex: Map<string, number>,
    baseKeys: string[],
  ): {
    zhIndex: number;
    enIndex: number;
    mnIndex: number;
  } {
    const normalizedBases = baseKeys
      .map((item) => this.normalizeCsvHeader(item))
      .filter((item) => item.length > 0);

    const buildCandidates = (
      suffixes: string[],
      prefixes: string[],
    ): string[] => {
      const result: string[] = [];
      for (const base of normalizedBases) {
        for (const suffix of suffixes) {
          result.push(`${base}${suffix}`);
        }
        for (const prefix of prefixes) {
          result.push(`${prefix}${base}`);
        }
      }
      return [...new Set(result)];
    };

    const zhIndex = this.pickIndex(
      headerIndex,
      buildCandidates(['zhcn', 'zh', 'cn'], ['zhcn', 'zh']),
    );
    const enIndex = this.pickIndex(
      headerIndex,
      buildCandidates(['enus', 'en', 'eng'], ['enus', 'en']),
    );
    const mnIndex = this.pickIndex(
      headerIndex,
      buildCandidates(['mnmn', 'mn', 'mon'], ['mnmn', 'mn']),
    );

    return {
      zhIndex,
      enIndex,
      mnIndex,
    };
  }

  private hasAnyI18nCell(
    cells: string[],
    indexes: { zhIndex: number; enIndex: number; mnIndex: number },
  ): boolean {
    const values = [indexes.zhIndex, indexes.enIndex, indexes.mnIndex]
      .filter((idx) => idx >= 0)
      .map((idx) => this.normalizeCsvCell(cells[idx] ?? ''));
    return values.some((value) => value.length > 0);
  }

  private parseNameI18n(
    cells: string[],
    indexes: { zhIndex: number; enIndex: number; mnIndex: number },
    fallbackEn: string,
  ): LocationNameI18n {
    const rawEn = this.normalizeCsvCell(
      indexes.enIndex >= 0 ? (cells[indexes.enIndex] ?? '') : '',
    );
    const rawZh = this.normalizeCsvCell(
      indexes.zhIndex >= 0 ? (cells[indexes.zhIndex] ?? '') : '',
    );
    const rawMn = this.normalizeCsvCell(
      indexes.mnIndex >= 0 ? (cells[indexes.mnIndex] ?? '') : '',
    );

    const en = rawEn || fallbackEn.trim();
    return {
      'zh-CN': rawZh || en,
      'en-US': en,
      'mn-MN': rawMn || en,
    };
  }

  private parseCountriesCsv(rows: string[][]): ParseResult<ParsedCountryRow> {
    const headerIndex = this.createHeaderIndex(rows[0] ?? []);
    const codeIndex = this.pickIndex(headerIndex, ['code']);
    const nameIndex = this.pickIndex(headerIndex, ['name']);
    const nameI18nIndexes = this.pickNameI18nIndexes(headerIndex, ['name']);
    const continentIndex = this.pickIndex(headerIndex, ['continent']);

    if (codeIndex < 0 || nameIndex < 0) {
      throw new BadRequestException({
        code: 'LOCATION_CSV_COUNTRIES_HEADER_INVALID',
        message:
          'countries.csv headers are invalid. Expected at least code,name.',
      });
    }

    const dataRows = rows.slice(1);
    const parsedRows: ParsedCountryRow[] = [];
    const errors: ImportErrorItem[] = [];
    let skipped = 0;

    for (let index = 0; index < dataRows.length; index += 1) {
      const cells = dataRows[index] ?? [];
      const rowNumber = index + 2;
      const code = this.normalizeCountryCode(cells[codeIndex] ?? '', '');
      const name = this.normalizeCsvCell(cells[nameIndex] ?? '');
      const nameI18n = this.parseNameI18n(cells, nameI18nIndexes, name);
      const continent = this.normalizeContinent(cells[continentIndex] ?? '');

      if (!code) {
        errors.push({ row: rowNumber, reason: 'Invalid country code.' });
        continue;
      }
      if (!name) {
        errors.push({ row: rowNumber, reason: 'Country name is empty.' });
        continue;
      }
      if (!AirportCsvImportService.ALLOWED_COUNTRY_CODES.has(code)) {
        skipped += 1;
        continue;
      }

      parsedRows.push({
        rowNumber,
        code,
        name,
        nameI18n,
        continent,
      });
    }

    return {
      totalRows: dataRows.length,
      rows: parsedRows,
      skipped,
      errors,
    };
  }

  private parseRegionsCsv(rows: string[][]): ParseResult<ParsedRegionRow> {
    const headerIndex = this.createHeaderIndex(rows[0] ?? []);
    const codeIndex = this.pickIndex(headerIndex, ['code']);
    const localCodeIndex = this.pickIndex(headerIndex, ['localcode']);
    const nameIndex = this.pickIndex(headerIndex, ['name']);
    const nameI18nIndexes = this.pickNameI18nIndexes(headerIndex, ['name']);
    const continentIndex = this.pickIndex(headerIndex, ['continent']);
    const countryIndex = this.pickIndex(headerIndex, ['isocountry']);

    if (codeIndex < 0 || nameIndex < 0 || countryIndex < 0) {
      throw new BadRequestException({
        code: 'LOCATION_CSV_REGIONS_HEADER_INVALID',
        message:
          'regions.csv headers are invalid. Expected at least code,name,iso_country.',
      });
    }

    const dataRows = rows.slice(1);
    const parsedRows: ParsedRegionRow[] = [];
    const errors: ImportErrorItem[] = [];
    let skipped = 0;

    for (let index = 0; index < dataRows.length; index += 1) {
      const cells = dataRows[index] ?? [];
      const rowNumber = index + 2;
      const code = this.normalizeRegionCode(cells[codeIndex] ?? '');
      const localCode = this.normalizeOptionalText(cells[localCodeIndex] ?? '');
      const name = this.normalizeCsvCell(cells[nameIndex] ?? '');
      const nameI18n = this.parseNameI18n(cells, nameI18nIndexes, name);
      const continent = this.normalizeContinent(cells[continentIndex] ?? '');
      const isoCountry = this.normalizeCountryCode(
        cells[countryIndex] ?? '',
        '',
      );

      if (!code) {
        errors.push({ row: rowNumber, reason: 'Invalid region code.' });
        continue;
      }
      if (!isoCountry) {
        errors.push({ row: rowNumber, reason: 'Invalid iso_country.' });
        continue;
      }
      if (!name) {
        errors.push({ row: rowNumber, reason: 'Region name is empty.' });
        continue;
      }
      if (!AirportCsvImportService.ALLOWED_COUNTRY_CODES.has(isoCountry)) {
        skipped += 1;
        continue;
      }

      parsedRows.push({
        rowNumber,
        code,
        localCode,
        name,
        nameI18n,
        continent,
        isoCountry,
      });
    }

    return {
      totalRows: dataRows.length,
      rows: parsedRows,
      skipped,
      errors,
    };
  }

  private parseAirportsCsv(rows: string[][]): ParseResult<ParsedAirportRow> {
    const headerIndex = this.createHeaderIndex(rows[0] ?? []);
    const typeIndex = this.pickIndex(headerIndex, ['type']);
    const nameIndex = this.pickIndex(headerIndex, ['name']);
    const nameI18nIndexes = this.pickNameI18nIndexes(headerIndex, [
      'name',
      'airportname',
    ]);
    const latitudeIndex = this.pickIndex(headerIndex, ['latitudedeg']);
    const longitudeIndex = this.pickIndex(headerIndex, ['longitudedeg']);
    const countryIndex = this.pickIndex(headerIndex, ['isocountry']);
    const regionIndex = this.pickIndex(headerIndex, ['isoregion']);
    const municipalityIndex = this.pickIndex(headerIndex, ['municipality']);
    const municipalityI18nIndexes = this.pickNameI18nIndexes(headerIndex, [
      'municipality',
      'city',
      'cityname',
    ]);
    const provinceI18nIndexes = this.pickNameI18nIndexes(headerIndex, [
      'province',
      'provincename',
      'regionname',
      'state',
    ]);
    const scheduledServiceIndex = this.pickIndex(headerIndex, [
      'scheduledservice',
    ]);
    const iataIndex = this.pickIndex(headerIndex, ['iatacode']);

    if (
      iataIndex < 0 ||
      nameIndex < 0 ||
      countryIndex < 0 ||
      regionIndex < 0 ||
      municipalityIndex < 0
    ) {
      throw new BadRequestException({
        code: 'LOCATION_CSV_AIRPORTS_HEADER_INVALID',
        message:
          'airports.csv headers are invalid. Expected iata_code,name,iso_country,iso_region,municipality.',
      });
    }

    const dataRows = rows.slice(1);
    const parsedRows: ParsedAirportRow[] = [];
    const errors: ImportErrorItem[] = [];
    let skipped = 0;

    for (let index = 0; index < dataRows.length; index += 1) {
      const cells = dataRows[index] ?? [];
      const rowNumber = index + 2;
      const airportCode = this.normalizeCsvAirportCode(cells[iataIndex] ?? '');
      const isoCountry = this.normalizeCountryCode(
        cells[countryIndex] ?? '',
        '',
      );
      const isoRegion = this.normalizeRegionCode(cells[regionIndex] ?? '');
      const municipality = this.normalizeCsvCell(
        cells[municipalityIndex] ?? '',
      );
      const airportName = this.normalizeCsvCell(cells[nameIndex] ?? '');
      const airportNameI18n = this.parseNameI18n(
        cells,
        nameI18nIndexes,
        airportName || airportCode,
      );
      const municipalityI18n = this.parseNameI18n(
        cells,
        municipalityI18nIndexes,
        municipality || airportName || airportCode,
      );
      const provinceI18n = this.hasAnyI18nCell(cells, provinceI18nIndexes)
        ? this.parseNameI18n(cells, provinceI18nIndexes, '')
        : null;
      const airportType = this.normalizeCsvCell(
        cells[typeIndex] ?? '',
      ).toLowerCase();
      const scheduledService = this.normalizeScheduledService(
        cells[scheduledServiceIndex] ?? '',
      );
      const latitude = this.parseCoordinate(cells[latitudeIndex] ?? '');
      const longitude = this.parseCoordinate(cells[longitudeIndex] ?? '');

      if (!airportCode || !isoCountry || !isoRegion) {
        skipped += 1;
        continue;
      }
      if (!this.isAirportWithinTargetScope(isoCountry, airportCode)) {
        skipped += 1;
        continue;
      }

      const row: ParsedAirportRow = {
        rowNumber,
        airportCode,
        name: airportName || airportCode,
        nameI18n: airportNameI18n,
        type: airportType,
        scheduledService,
        isoCountry,
        isoRegion,
        municipality,
        municipalityI18n,
        provinceI18n,
        latitude,
        longitude,
      };

      if (!this.shouldImportAirport(row)) {
        skipped += 1;
        continue;
      }

      parsedRows.push(row);
    }

    return {
      totalRows: dataRows.length,
      rows: parsedRows,
      skipped,
      errors,
    };
  }

  private shouldImportAirport(row: ParsedAirportRow): boolean {
    if (row.scheduledService === 'yes') {
      return true;
    }
    return row.type === 'large_airport' || row.type === 'medium_airport';
  }

  private isAirportWithinTargetScope(
    isoCountry: string,
    airportCode: string,
  ): boolean {
    if (isoCountry === 'CN') {
      return true;
    }
    return AirportCsvImportService.ALLOWED_IATA_CODES.has(airportCode);
  }

  private resolveProvinceInfo(
    countryCode: string,
    regionCode: string,
    regionByCode: Map<string, LocationRegionRef>,
    incomingI18n: LocationNameI18n | null,
  ): { name: string; nameI18n: LocationNameI18n } {
    const normalizedCode = this.normalizeRegionCode(regionCode);
    const region = regionByCode.get(normalizedCode);

    let fallbackName = '';

    if (region?.name?.trim()) {
      fallbackName = region.name.trim();
    } else {
      if (countryCode === 'CN' && normalizedCode.includes('-')) {
        const suffix = normalizedCode.split('-')[1] || '';
        const mapped = AirportCsvImportService.CN_REGION_CODE_TO_NAME[suffix];
        if (mapped) {
          fallbackName = mapped;
        }
      }

      if (!fallbackName) {
        if (normalizedCode.includes('-')) {
          fallbackName = normalizedCode.split('-')[1] || normalizedCode;
        } else {
          fallbackName = normalizedCode || `Unknown Region (${countryCode})`;
        }
      }
    }

    const fromRegion = this.mergeNameI18n(
      this.buildFallbackNameI18n(fallbackName),
      region?.nameI18n ?? null,
      fallbackName,
    );
    const merged = this.mergeNameI18n(
      fromRegion,
      incomingI18n,
      fromRegion['en-US'] || fallbackName,
    );
    const name = merged['en-US']?.trim() || fallbackName;

    return {
      name,
      nameI18n: merged,
    };
  }

  private detectDatasetType(
    requestedType: LocationCsvDatasetType,
    header: string[],
  ): DetectedDatasetType {
    if (requestedType && requestedType !== 'auto') {
      return requestedType;
    }

    const normalizedHeader = new Set(
      header.map((cell) => this.normalizeCsvHeader(cell)),
    );

    if (
      normalizedHeader.has('iatacode') &&
      normalizedHeader.has('isocountry') &&
      normalizedHeader.has('isoregion')
    ) {
      return 'airports';
    }

    if (
      normalizedHeader.has('code') &&
      normalizedHeader.has('name') &&
      normalizedHeader.has('isocountry') &&
      normalizedHeader.has('localcode')
    ) {
      return 'regions';
    }

    if (
      normalizedHeader.has('code') &&
      normalizedHeader.has('name') &&
      normalizedHeader.has('continent')
    ) {
      return 'countries';
    }

    throw new BadRequestException({
      code: 'LOCATION_CSV_DATASET_UNKNOWN',
      message:
        'Cannot detect CSV dataset type automatically. Please set datasetType explicitly.',
    });
  }

  private parseCsvRows(csvContent: string): string[][] {
    const raw = csvContent.replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i];
      const next = raw[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && char === ',') {
        row.push(current);
        current = '';
        continue;
      }

      if (!inQuotes && (char === '\n' || char === '\r')) {
        if (char === '\r' && next === '\n') {
          i += 1;
        }
        row.push(current);
        if (row.some((cell) => cell.trim().length > 0)) {
          rows.push(row.map((cell) => cell.trim()));
        }
        row = [];
        current = '';
        continue;
      }

      current += char;
    }

    row.push(current);
    if (row.some((cell) => cell.trim().length > 0)) {
      rows.push(row.map((cell) => cell.trim()));
    }
    return rows;
  }

  private createHeaderIndex(headerCells: string[]): Map<string, number> {
    const result = new Map<string, number>();
    for (let i = 0; i < headerCells.length; i += 1) {
      const normalized = this.normalizeCsvHeader(headerCells[i] ?? '');
      if (normalized && !result.has(normalized)) {
        result.set(normalized, i);
      }
    }
    return result;
  }

  private pickIndex(headerIndex: Map<string, number>, keys: string[]): number {
    for (const key of keys) {
      const found = headerIndex.get(key);
      if (typeof found === 'number') {
        return found;
      }
    }
    return -1;
  }

  private normalizeCsvHeader(raw: string): string {
    return raw
      .trim()
      .toLowerCase()
      .replace(/[\s_\-（）()]/g, '');
  }

  private normalizeCsvCell(raw: string): string {
    return raw.trim();
  }

  private normalizeOptionalText(raw: string): string | null {
    const normalized = raw.trim();
    return normalized || null;
  }

  private normalizeCountryCode(raw: string, fallback: string): string {
    const normalized = raw.trim().toUpperCase();
    if (!normalized) {
      return fallback;
    }
    return /^[A-Z]{2}$/.test(normalized) ? normalized : fallback;
  }

  private normalizeContinent(raw: string): string | null {
    const normalized = raw.trim().toUpperCase();
    if (!normalized) {
      return null;
    }
    return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
  }

  private normalizeRegionCode(raw: string): string {
    const normalized = raw.trim().toUpperCase();
    if (!normalized) {
      return '';
    }
    return /^[A-Z0-9-]{2,16}$/.test(normalized) ? normalized : '';
  }

  private normalizeCsvAirportCode(raw: string): string {
    const normalized = raw.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,8}$/.test(normalized)) {
      return '';
    }
    return normalized;
  }

  private normalizeScheduledService(raw: string): 'yes' | 'no' | '' {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'yes') return 'yes';
    if (normalized === 'no') return 'no';
    return '';
  }

  private parseCoordinate(raw: string): number | null {
    const text = raw.trim();
    if (!text) {
      return null;
    }
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
  }
}
