import {
  ensureGuideI18n,
  ensureIntroI18n,
  ensureNoticeI18n,
  ensureRegionI18n,
  ensureTextI18n,
  resolveName,
} from '../utils/content-i18n.util';

export interface BasePlaceCreatePayload {
  nameZhCN: string;
  nameMnMN: string;
  nameEn: string;
  province: string;
  provinceMnMN: string;
  provinceZhCN: string;
  city: string;
  cityMnMN: string;
  cityZhCN: string;
  latitude?: number;
  longitude?: number;
  coverImageUrl?: string;
  introMnMN: string;
  introZhCN: string;
  introEn: string;
  guideMnMN: string;
  guideZhCN: string;
  guideEn: string;
  noticeMnMN: string;
  noticeZhCN: string;
  noticeEn: string;
}

export interface BasePlaceUpdatePayload {
  nameZhCN?: string;
  nameMnMN?: string;
  nameEn?: string;
  province?: string;
  provinceMnMN?: string;
  provinceZhCN?: string;
  city?: string;
  cityMnMN?: string;
  cityZhCN?: string;
  latitude?: number;
  longitude?: number;
  coverImageUrl?: string;
  introMnMN?: string;
  introZhCN?: string;
  introEn?: string;
  guideMnMN?: string;
  guideZhCN?: string;
  guideEn?: string;
  noticeMnMN?: string;
  noticeZhCN?: string;
  noticeEn?: string;
  isPublished?: boolean;
}

export interface BasePlaceEntity {
  name: string;
  nameI18n: Record<string, string | undefined> | null;
  country: string;
  province: string;
  provinceI18n: Record<string, string | undefined> | null;
  city: string;
  cityI18n: Record<string, string | undefined> | null;
  latitude: number | null;
  longitude: number | null;
  coverImageUrl: string | null;
  introI18n: Record<string, string | undefined>;
  guideI18n: Record<string, string | undefined> | null;
  noticeI18n: Record<string, string | undefined> | null;
  isPublished: boolean;
}

export abstract class BasePlaceService<T extends BasePlaceEntity> {
  protected buildBaseCreatePayload(dto: BasePlaceCreatePayload): Partial<T> {
    const provinceEn = dto.province.trim();
    const provinceMn = dto.provinceMnMN.trim();
    const provinceZh = dto.provinceZhCN.trim();
    const cityEn = dto.city.trim();
    const cityMn = dto.cityMnMN.trim();
    const cityZh = dto.cityZhCN.trim();

    const nameI18n = {
      'zh-CN': dto.nameZhCN.trim(),
      'mn-MN': dto.nameMnMN.trim(),
      'en-US': dto.nameEn.trim(),
    };

    return {
      name: nameI18n['zh-CN'],
      nameI18n,
      country: 'CN',
      province: provinceEn,
      provinceI18n: {
        'zh-CN': provinceZh,
        'en-US': provinceEn,
        'mn-MN': provinceMn,
      },
      city: cityEn,
      cityI18n: {
        'zh-CN': cityZh,
        'en-US': cityEn,
        'mn-MN': cityMn,
      },
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      coverImageUrl: dto.coverImageUrl?.trim() || null,
      introI18n: {
        'zh-CN': dto.introZhCN.trim(),
        'mn-MN': dto.introMnMN.trim(),
        'en-US': dto.introEn.trim(),
      },
      guideI18n: {
        'zh-CN': dto.guideZhCN.trim(),
        'mn-MN': dto.guideMnMN.trim(),
        'en-US': dto.guideEn.trim(),
      },
      noticeI18n: {
        'zh-CN': dto.noticeZhCN.trim(),
        'mn-MN': dto.noticeMnMN.trim(),
        'en-US': dto.noticeEn.trim(),
      },
    } as unknown as Partial<T>;
  }

  protected applyBaseUpdates(entity: T, dto: BasePlaceUpdatePayload): void {
    if (
      dto.nameZhCN !== undefined ||
      dto.nameMnMN !== undefined ||
      dto.nameEn !== undefined
    ) {
      const nextNameI18n = {
        ...ensureTextI18n(entity.nameI18n, entity.name),
        ...(dto.nameZhCN !== undefined ? { 'zh-CN': dto.nameZhCN.trim() } : {}),
        ...(dto.nameMnMN !== undefined ? { 'mn-MN': dto.nameMnMN.trim() } : {}),
        ...(dto.nameEn !== undefined ? { 'en-US': dto.nameEn.trim() } : {}),
      };
      entity.nameI18n = nextNameI18n;
      entity.name = resolveName(nextNameI18n, 'zh-CN');
    }

    if (
      dto.province !== undefined ||
      dto.provinceMnMN !== undefined ||
      dto.provinceZhCN !== undefined
    ) {
      const nextProvinceEn = dto.province?.trim() ?? entity.province;
      entity.province = nextProvinceEn;
      entity.provinceI18n = {
        ...ensureRegionI18n(entity.provinceI18n, nextProvinceEn),
        ...(dto.province !== undefined ? { 'en-US': nextProvinceEn } : {}),
        ...(dto.provinceZhCN !== undefined
          ? { 'zh-CN': dto.provinceZhCN.trim() }
          : {}),
        ...(dto.provinceMnMN !== undefined
          ? { 'mn-MN': dto.provinceMnMN.trim() }
          : {}),
      };
    }

    if (
      dto.city !== undefined ||
      dto.cityMnMN !== undefined ||
      dto.cityZhCN !== undefined
    ) {
      const nextCityEn = dto.city?.trim() ?? entity.city;
      entity.city = nextCityEn;
      entity.cityI18n = {
        ...ensureRegionI18n(entity.cityI18n, nextCityEn),
        ...(dto.city !== undefined ? { 'en-US': nextCityEn } : {}),
        ...(dto.cityZhCN !== undefined ? { 'zh-CN': dto.cityZhCN.trim() } : {}),
        ...(dto.cityMnMN !== undefined ? { 'mn-MN': dto.cityMnMN.trim() } : {}),
      };
    }

    if (dto.latitude !== undefined) {
      entity.latitude = dto.latitude;
    }
    if (dto.longitude !== undefined) {
      entity.longitude = dto.longitude;
    }
    if (dto.coverImageUrl !== undefined) {
      entity.coverImageUrl = dto.coverImageUrl?.trim() || null;
    }

    if (
      dto.introZhCN !== undefined ||
      dto.introMnMN !== undefined ||
      dto.introEn !== undefined
    ) {
      entity.introI18n = {
        ...ensureIntroI18n(entity.introI18n),
        ...(dto.introZhCN !== undefined
          ? { 'zh-CN': dto.introZhCN.trim() }
          : {}),
        ...(dto.introMnMN !== undefined
          ? { 'mn-MN': dto.introMnMN.trim() }
          : {}),
        ...(dto.introEn !== undefined ? { 'en-US': dto.introEn.trim() } : {}),
      };
    }

    if (
      dto.guideZhCN !== undefined ||
      dto.guideMnMN !== undefined ||
      dto.guideEn !== undefined
    ) {
      entity.guideI18n = {
        ...ensureGuideI18n(entity.guideI18n),
        ...(dto.guideZhCN !== undefined
          ? { 'zh-CN': dto.guideZhCN.trim() }
          : {}),
        ...(dto.guideMnMN !== undefined
          ? { 'mn-MN': dto.guideMnMN.trim() }
          : {}),
        ...(dto.guideEn !== undefined ? { 'en-US': dto.guideEn.trim() } : {}),
      };
    }

    if (
      dto.noticeZhCN !== undefined ||
      dto.noticeMnMN !== undefined ||
      dto.noticeEn !== undefined
    ) {
      entity.noticeI18n = {
        ...ensureNoticeI18n(entity.noticeI18n),
        ...(dto.noticeZhCN !== undefined
          ? { 'zh-CN': dto.noticeZhCN.trim() }
          : {}),
        ...(dto.noticeMnMN !== undefined
          ? { 'mn-MN': dto.noticeMnMN.trim() }
          : {}),
        ...(dto.noticeEn !== undefined
          ? { 'en-US': dto.noticeEn.trim() }
          : {}),
      };
    }

    if (dto.isPublished !== undefined) {
      entity.isPublished = dto.isPublished;
    }
  }
}
