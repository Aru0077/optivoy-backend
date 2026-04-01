import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../../../app.module';
import { HotelPlace } from '../../hotels/entities/hotel.entity';
import { LocationAirport } from '../../locations/entities/location-airport.entity';
import { LocationCity } from '../../locations/entities/location-city.entity';
import { LocationCountryRef } from '../../locations/entities/location-country-ref.entity';
import { LocationProvince } from '../../locations/entities/location-province.entity';
import { RestaurantMealSlot, RestaurantPlace } from '../../restaurants/entities/restaurant.entity';
import { ShoppingPlace } from '../../shopping/entities/shopping.entity';
import { Spot } from '../../spots/entities/spot.entity';

interface AirportSeed {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
}

interface SpotSeed {
  name: string;
  latitude: number;
  longitude: number;
  suggestedDurationMinutes: number;
}

interface ShoppingSeed {
  name: string;
  latitude: number;
  longitude: number;
  suggestedDurationMinutes: number;
}

interface RestaurantSeed {
  name: string;
  latitude: number;
  longitude: number;
  suggestedDurationMinutes: number;
  mealSlots: RestaurantMealSlot[];
}

interface HotelSeed {
  name: string;
  latitude: number;
  longitude: number;
  starLevel: number;
  bookingUrl: string;
}

interface CityRegressionSeed {
  country: 'CN' | 'MN';
  province: string;
  city: string;
  airports: AirportSeed[];
  spots: SpotSeed[];
  shopping: ShoppingSeed[];
  restaurants: RestaurantSeed[];
  hotels: HotelSeed[];
}

const REGRESSION_SEEDS: CityRegressionSeed[] = [
  {
    country: 'CN',
    province: 'Beijing',
    city: 'Beijing',
    airports: [
      {
        code: 'PEK',
        name: 'Beijing Capital International Airport',
        latitude: 40.0799,
        longitude: 116.6031,
      },
      {
        code: 'PKX',
        name: 'Beijing Daxing International Airport',
        latitude: 39.5099,
        longitude: 116.4108,
      },
    ],
    spots: [
      {
        name: 'Forbidden City',
        latitude: 39.9163,
        longitude: 116.3972,
        suggestedDurationMinutes: 240,
      },
      {
        name: 'Temple of Heaven',
        latitude: 39.8822,
        longitude: 116.4065,
        suggestedDurationMinutes: 150,
      },
    ],
    shopping: [
      {
        name: 'Wangfujing Street',
        latitude: 39.9154,
        longitude: 116.4103,
        suggestedDurationMinutes: 120,
      },
      {
        name: 'Sanlitun Taikooli',
        latitude: 39.9366,
        longitude: 116.4549,
        suggestedDurationMinutes: 150,
      },
    ],
    restaurants: [
      {
        name: 'Quanjude Qianmen',
        latitude: 39.8954,
        longitude: 116.4049,
        suggestedDurationMinutes: 90,
        mealSlots: ['lunch', 'dinner'],
      },
      {
        name: 'Donglaishun Wangfujing',
        latitude: 39.9148,
        longitude: 116.4118,
        suggestedDurationMinutes: 90,
        mealSlots: ['lunch', 'dinner'],
      },
    ],
    hotels: [
      {
        name: 'Beijing Hotel NUO',
        latitude: 39.9079,
        longitude: 116.4157,
        starLevel: 5,
        bookingUrl: 'https://www.trip.com/hotels/',
      },
      {
        name: 'Novotel Beijing Peace',
        latitude: 39.9142,
        longitude: 116.4172,
        starLevel: 4,
        bookingUrl: 'https://www.trip.com/hotels/',
      },
    ],
  },
  {
    country: 'MN',
    province: 'Ulaanbaatar',
    city: 'Ulaanbaatar',
    airports: [
      {
        code: 'UBN',
        name: 'Chinggis Khaan International Airport',
        latitude: 47.6469,
        longitude: 106.8198,
      },
    ],
    spots: [
      {
        name: 'Gandantegchinlen Monastery',
        latitude: 47.9221,
        longitude: 106.8945,
        suggestedDurationMinutes: 120,
      },
      {
        name: 'Bogd Khan Palace Museum',
        latitude: 47.8999,
        longitude: 106.9057,
        suggestedDurationMinutes: 120,
      },
    ],
    shopping: [
      {
        name: 'State Department Store Ulaanbaatar',
        latitude: 47.9181,
        longitude: 106.9179,
        suggestedDurationMinutes: 120,
      },
      {
        name: 'Narantuul Market',
        latitude: 47.9227,
        longitude: 106.9385,
        suggestedDurationMinutes: 120,
      },
    ],
    restaurants: [
      {
        name: 'Modern Nomads UB',
        latitude: 47.9177,
        longitude: 106.9165,
        suggestedDurationMinutes: 90,
        mealSlots: ['lunch', 'dinner'],
      },
      {
        name: 'Hazara Indian Restaurant UB',
        latitude: 47.9134,
        longitude: 106.9143,
        suggestedDurationMinutes: 90,
        mealSlots: ['lunch', 'dinner'],
      },
    ],
    hotels: [
      {
        name: 'Shangri-La Ulaanbaatar',
        latitude: 47.9143,
        longitude: 106.9156,
        starLevel: 5,
        bookingUrl: 'https://www.trip.com/hotels/',
      },
      {
        name: 'Best Western Premier Tuushin Hotel',
        latitude: 47.9188,
        longitude: 106.9172,
        starLevel: 4,
        bookingUrl: 'https://www.trip.com/hotels/',
      },
    ],
  },
];

function buildI18n(name: string): Record<string, string> {
  return {
    'zh-CN': name,
    'en-US': name,
    'mn-MN': name,
  };
}

async function upsertCountry(
  countryRepo: Repository<LocationCountryRef>,
  code: string,
): Promise<void> {
  const existing = await countryRepo.findOne({ where: { code } });
  const name = code === 'CN' ? 'China' : 'Mongolia';
  if (existing) {
    existing.name = name;
    existing.nameI18n = buildI18n(name);
    existing.continent = 'AS';
    await countryRepo.save(existing);
    return;
  }
  await countryRepo.save(
    countryRepo.create({
      code,
      name,
      nameI18n: buildI18n(name),
      continent: 'AS',
    }),
  );
}

async function upsertProvince(
  provinceRepo: Repository<LocationProvince>,
  seed: CityRegressionSeed,
): Promise<LocationProvince> {
  const existing = await provinceRepo.findOne({
    where: {
      country: seed.country,
      name: seed.province,
    },
  });

  if (existing) {
    existing.nameI18n = buildI18n(seed.province);
    return provinceRepo.save(existing);
  }

  return provinceRepo.save(
    provinceRepo.create({
      country: seed.country,
      name: seed.province,
      nameI18n: buildI18n(seed.province),
    }),
  );
}

async function upsertCity(
  cityRepo: Repository<LocationCity>,
  province: LocationProvince,
  cityName: string,
): Promise<LocationCity> {
  const existing = await cityRepo.findOne({
    where: {
      provinceId: province.id,
      name: cityName,
    },
  });

  if (existing) {
    existing.nameI18n = buildI18n(cityName);
    return cityRepo.save(existing);
  }

  return cityRepo.save(
    cityRepo.create({
      provinceId: province.id,
      name: cityName,
      nameI18n: buildI18n(cityName),
    }),
  );
}

async function upsertAirports(
  airportRepo: Repository<LocationAirport>,
  city: LocationCity,
  airports: AirportSeed[],
): Promise<void> {
  for (const airport of airports) {
    const existing = await airportRepo.findOne({
      where: { airportCode: airport.code },
    });
    if (existing) {
      existing.cityId = city.id;
      existing.name = airport.name;
      existing.nameI18n = buildI18n(airport.name);
      existing.latitude = airport.latitude;
      existing.longitude = airport.longitude;
      await airportRepo.save(existing);
      continue;
    }

    await airportRepo.save(
      airportRepo.create({
        cityId: city.id,
        airportCode: airport.code,
        name: airport.name,
        nameI18n: buildI18n(airport.name),
        latitude: airport.latitude,
        longitude: airport.longitude,
      }),
    );
  }
}

async function upsertSpots(
  spotRepo: Repository<Spot>,
  seed: CityRegressionSeed,
): Promise<void> {
  for (const spot of seed.spots) {
    const existing = await spotRepo.findOne({
      where: {
        name: spot.name,
        country: seed.country,
        province: seed.province,
        city: seed.city,
      },
    });

    const payload = {
      name: spot.name,
      nameI18n: buildI18n(spot.name),
      country: seed.country,
      province: seed.province,
      provinceI18n: buildI18n(seed.province),
      city: seed.city,
      cityI18n: buildI18n(seed.city),
      entryLatitude: spot.latitude,
      entryLongitude: spot.longitude,
      exitLatitude: spot.latitude,
      exitLongitude: spot.longitude,
      introI18n: buildI18n(`${spot.name} intro`),
      guideI18n: buildI18n(`${spot.name} guide`),
      suggestedDurationMinutes: spot.suggestedDurationMinutes,
      reservationRequired: false,
      isPublished: true,
      coverImageUrl: null,
      reservationUrl: null,
      reservationNoteI18n: null,
      closedWeekdays: null,
      ticketPriceMinCny: null,
      ticketPriceMaxCny: null,
    };

    if (existing) {
      Object.assign(existing, payload);
      await spotRepo.save(existing);
      continue;
    }

    await spotRepo.save(spotRepo.create(payload));
  }
}

async function upsertShopping(
  shoppingRepo: Repository<ShoppingPlace>,
  seed: CityRegressionSeed,
): Promise<void> {
  for (const item of seed.shopping) {
    const existing = await shoppingRepo.findOne({
      where: {
        name: item.name,
        country: seed.country,
        province: seed.province,
        city: seed.city,
      },
    });

    const payload = {
      name: item.name,
      nameI18n: buildI18n(item.name),
      country: seed.country,
      province: seed.province,
      provinceI18n: buildI18n(seed.province),
      city: seed.city,
      cityI18n: buildI18n(seed.city),
      latitude: item.latitude,
      longitude: item.longitude,
      introI18n: buildI18n(`${item.name} intro`),
      guideI18n: buildI18n(`${item.name} guide`),
      openingHours: '10:00-22:00',
      suggestedDurationMinutes: item.suggestedDurationMinutes,
      avgSpendMinCny: null,
      avgSpendMaxCny: null,
      isPublished: true,
      coverImageUrl: null,
    };

    if (existing) {
      Object.assign(existing, payload);
      await shoppingRepo.save(existing);
      continue;
    }

    await shoppingRepo.save(shoppingRepo.create(payload));
  }
}

async function upsertRestaurants(
  restaurantRepo: Repository<RestaurantPlace>,
  seed: CityRegressionSeed,
): Promise<void> {
  for (const item of seed.restaurants) {
    const existing = await restaurantRepo.findOne({
      where: {
        name: item.name,
        country: seed.country,
        province: seed.province,
        city: seed.city,
      },
    });

    const payload = {
      name: item.name,
      nameI18n: buildI18n(item.name),
      country: seed.country,
      province: seed.province,
      provinceI18n: buildI18n(seed.province),
      city: seed.city,
      cityI18n: buildI18n(seed.city),
      latitude: item.latitude,
      longitude: item.longitude,
      introI18n: buildI18n(`${item.name} intro`),
      guideI18n: buildI18n(`${item.name} guide`),
      openingHours: '11:00-21:30',
      suggestedDurationMinutes: item.suggestedDurationMinutes,
      mealSlots: item.mealSlots,
      cuisineTags: ['signature'],
      reservationRequired: false,
      reservationUrl: null,
      avgSpendMinCny: null,
      avgSpendMaxCny: null,
      closedWeekdays: null,
      isPublished: true,
      coverImageUrl: null,
    };

    if (existing) {
      Object.assign(existing, payload);
      await restaurantRepo.save(existing);
      continue;
    }

    await restaurantRepo.save(restaurantRepo.create(payload));
  }
}

async function upsertHotels(
  hotelRepo: Repository<HotelPlace>,
  seed: CityRegressionSeed,
): Promise<void> {
  for (const item of seed.hotels) {
    const existing = await hotelRepo.findOne({
      where: {
        name: item.name,
        country: seed.country,
        province: seed.province,
        city: seed.city,
      },
    });

    const payload = {
      name: item.name,
      nameI18n: buildI18n(item.name),
      country: seed.country,
      province: seed.province,
      provinceI18n: buildI18n(seed.province),
      city: seed.city,
      cityI18n: buildI18n(seed.city),
      latitude: item.latitude,
      longitude: item.longitude,
      introI18n: buildI18n(`${item.name} intro`),
      guideI18n: buildI18n(`${item.name} guide`),
      starLevel: item.starLevel,
      foreignerFriendly: true,
      checkInTime: '14:00',
      checkOutTime: '12:00',
      bookingUrl: item.bookingUrl,
      pricePerNightMinCny: null,
      pricePerNightMaxCny: null,
      isPublished: true,
      coverImageUrl: null,
    };

    if (existing) {
      Object.assign(existing, payload);
      await hotelRepo.save(existing);
      continue;
    }

    await hotelRepo.save(hotelRepo.create(payload));
  }
}

async function runRegressionDatasetSeed(): Promise<void> {
  const logger = new Logger('RegressionDatasetSeedRunner');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = app.get(DataSource);
    const countryRepo = dataSource.getRepository(LocationCountryRef);
    const provinceRepo = dataSource.getRepository(LocationProvince);
    const cityRepo = dataSource.getRepository(LocationCity);
    const airportRepo = dataSource.getRepository(LocationAirport);
    const spotRepo = dataSource.getRepository(Spot);
    const shoppingRepo = dataSource.getRepository(ShoppingPlace);
    const restaurantRepo = dataSource.getRepository(RestaurantPlace);
    const hotelRepo = dataSource.getRepository(HotelPlace);

    for (const seed of REGRESSION_SEEDS) {
      await upsertCountry(countryRepo, seed.country);
      const province = await upsertProvince(provinceRepo, seed);
      const city = await upsertCity(cityRepo, province, seed.city);

      await upsertAirports(airportRepo, city, seed.airports);
      await upsertSpots(spotRepo, seed);
      await upsertShopping(shoppingRepo, seed);
      await upsertRestaurants(restaurantRepo, seed);
      await upsertHotels(hotelRepo, seed);

      logger.log(
        `Seeded regression city ${seed.country}/${seed.province}/${seed.city} with ${seed.spots.length} spots, ${seed.shopping.length} shopping, ${seed.restaurants.length} restaurants, ${seed.hotels.length} hotels, ${seed.airports.length} airports.`,
      );
    }

    logger.log('Regression dataset seed finished');
  } finally {
    await app.close();
  }
}

void runRegressionDatasetSeed();
