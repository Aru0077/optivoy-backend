import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SpotLang } from '../spots/dto/list-spots-query.dto';
import { SpotsService } from '../spots/spots.service';
import { HomeSettingEntity } from './entities/home-setting.entity';

const BANNER_BACKGROUND_SETTING_KEY = 'bannerBackgroundImageUrl';
const DEFAULT_HOME_BANNER_BACKGROUND_IMAGE_URL =
  'https://optivoy.oss-cn-beijing.aliyuncs.com/scenic-spot/Tianmen%20Mountain.png';

@Injectable()
export class HomeService {
  constructor(
    private readonly spotsService: SpotsService,
    private readonly configService: ConfigService,
    @InjectRepository(HomeSettingEntity)
    private readonly homeSettingsRepository: Repository<HomeSettingEntity>,
  ) {}

  async getHome(input: { lang: SpotLang }): Promise<{
    recommendedSpots: Awaited<ReturnType<SpotsService['listSpots']>>;
    bannerBackgroundImageUrl: string;
  }> {
    const [recommendedSpots, bannerBackgroundImageUrl] = await Promise.all([
      this.spotsService.listSpots({
        lang: input.lang,
        limit: 10,
        offset: 0,
      }),
      this.readBannerBackgroundImageUrl(),
    ]);

    return { recommendedSpots, bannerBackgroundImageUrl };
  }

  async updateBannerBackgroundImage(input: { imageUrl: string }): Promise<{
    bannerBackgroundImageUrl: string;
  }> {
    const normalizedUrl = input.imageUrl.trim();
    await this.homeSettingsRepository.upsert(
      {
        key: BANNER_BACKGROUND_SETTING_KEY,
        value: normalizedUrl,
      },
      ['key'],
    );
    return { bannerBackgroundImageUrl: normalizedUrl };
  }

  async getBannerBackgroundImage(): Promise<{
    bannerBackgroundImageUrl: string;
  }> {
    return {
      bannerBackgroundImageUrl: await this.readBannerBackgroundImageUrl(),
    };
  }

  private async readBannerBackgroundImageUrl(): Promise<string> {
    const existing = await this.homeSettingsRepository.findOneBy({
      key: BANNER_BACKGROUND_SETTING_KEY,
    });
    if (existing?.value?.trim()) {
      return existing.value.trim();
    }

    const configured = this.configService
      .get<string>('HOME_BANNER_BACKGROUND_URL')
      ?.trim();
    if (configured) {
      return configured;
    }

    return DEFAULT_HOME_BANNER_BACKGROUND_IMAGE_URL;
  }
}
