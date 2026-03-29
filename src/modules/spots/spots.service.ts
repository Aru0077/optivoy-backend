import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateSpotDto } from './dto/create-spot.dto';
import { ListAdminSpotsQueryDto } from './dto/list-admin-spots-query.dto';
import { ListCityGroupsQueryDto } from './dto/list-city-groups-query.dto';
import { ListSpotsQueryDto, SpotLang } from './dto/list-spots-query.dto';
import { UpdateSpotDto } from './dto/update-spot.dto';
import { Spot } from './entities/spot.entity';
import { SpotAdminService } from './spot-admin.service';
import { SpotPublicService } from './spot-public.service';
import { CityGroupItem, SpotView } from './spots.types';

@Injectable()
export class SpotsService {
  private readonly adminService: SpotAdminService;
  private readonly publicService: SpotPublicService;

  constructor(
    @InjectRepository(Spot)
    private readonly spotRepository: Repository<Spot>,
    private readonly dataSource: DataSource,
  ) {
    this.adminService = new SpotAdminService(this.spotRepository);
    this.publicService = new SpotPublicService(
      this.spotRepository,
      this.dataSource,
    );
  }

  createSpot(dto: CreateSpotDto): Promise<SpotView> {
    return this.adminService.createSpot(dto);
  }

  updateSpot(spotId: string, dto: UpdateSpotDto): Promise<SpotView> {
    return this.adminService.updateSpot(spotId, dto);
  }

  deleteSpot(spotId: string): Promise<void> {
    return this.adminService.deleteSpot(spotId);
  }

  listAdminSpots(
    query: ListAdminSpotsQueryDto,
  ): Promise<{ total: number; items: SpotView[] }> {
    return this.adminService.listAdminSpots(query);
  }

  getAdminSpotById(spotId: string): Promise<SpotView> {
    return this.adminService.getAdminSpotById(spotId);
  }

  listSpots(
    query: ListSpotsQueryDto,
  ): Promise<{ total: number; items: SpotView[] }> {
    return this.publicService.listSpots(query);
  }

  listCityGroups(
    query: ListCityGroupsQueryDto,
  ): Promise<{ total: number; items: CityGroupItem[] }> {
    return this.publicService.listCityGroups(query);
  }

  getSpotById(spotId: string, lang: SpotLang): Promise<SpotView> {
    return this.publicService.getSpotById(spotId, lang);
  }
}
