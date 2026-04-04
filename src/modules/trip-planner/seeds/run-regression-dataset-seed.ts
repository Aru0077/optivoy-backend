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
  arrivalBufferMinutes: number;
  departureBufferMinutes: number;
  arrivalAnchorLatitude: number;
  arrivalAnchorLongitude: number;
  departureAnchorLatitude: number;
  departureAnchorLongitude: number;
}

interface SpotSeed {
  name: string;
  entryLatitude: number;
  entryLongitude: number;
  exitLatitude: number;
  exitLongitude: number;
  suggestedDurationMinutes: number;
  openingHoursJson: Array<{
    weekday: number;
    periods: Array<{ start: string; end: string }>;
  }>;
  lastEntryTime: string;
  reservationRequired?: boolean;
  reservationCutoffMinutes?: number | null;
  reservationTimeSlotsJson?: string[] | null;
  queueProfileJson?: {
    weekdayMinutes?: number;
    weekendMinutes?: number;
    holidayMinutes?: number;
  } | null;
  bestVisitWindowsJson?: Array<{ start: string; end: string; tag: string }> | null;
}

interface ShoppingSeed {
  name: string;
  latitude: number;
  longitude: number;
  suggestedDurationMinutes: number;
  arrivalAnchorLatitude: number;
  arrivalAnchorLongitude: number;
  departureAnchorLatitude: number;
  departureAnchorLongitude: number;
  openingHoursJson: Array<{
    weekday: number;
    periods: Array<{ start: string; end: string }>;
  }>;
}

interface RestaurantSeed {
  name: string;
  latitude: number;
  longitude: number;
  suggestedDurationMinutes: number;
  mealSlots: RestaurantMealSlot[];
  arrivalAnchorLatitude: number;
  arrivalAnchorLongitude: number;
  departureAnchorLatitude: number;
  departureAnchorLongitude: number;
  mealTimeWindowsJson: Array<{
    mealSlot: RestaurantMealSlot;
    start: string;
    end: string;
  }>;
  queueProfileJson?: {
    weekdayMinutes?: number;
    weekendMinutes?: number;
    holidayMinutes?: number;
  } | null;
}

interface HotelSeed {
  name: string;
  latitude: number;
  longitude: number;
  starLevel: number;
  bookingUrl: string;
  foreignerFriendly: boolean;
  checkInTime: string;
  checkOutTime: string;
  arrivalAnchorLatitude: number;
  arrivalAnchorLongitude: number;
  departureAnchorLatitude: number;
  departureAnchorLongitude: number;
  bookingStatus: 'available' | 'limited' | 'sold_out' | 'unknown';
  bookableDatesJson: string[];
  pricePerNightMinCny: number | null;
  pricePerNightMaxCny: number | null;
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
        arrivalBufferMinutes: 45,
        departureBufferMinutes: 150,
        arrivalAnchorLatitude: 40.0804,
        arrivalAnchorLongitude: 116.6022,
        departureAnchorLatitude: 40.0788,
        departureAnchorLongitude: 116.6041,
      },
      {
        code: 'PKX',
        name: 'Beijing Daxing International Airport',
        latitude: 39.5099,
        longitude: 116.4108,
        arrivalBufferMinutes: 55,
        departureBufferMinutes: 160,
        arrivalAnchorLatitude: 39.5105,
        arrivalAnchorLongitude: 116.4096,
        departureAnchorLatitude: 39.5092,
        departureAnchorLongitude: 116.4119,
      },
    ],
    spots: [
      {
        name: 'Forbidden City',
        entryLatitude: 39.9163,
        entryLongitude: 116.3972,
        exitLatitude: 39.9149,
        exitLongitude: 116.4035,
        suggestedDurationMinutes: 240,
        openingHoursJson: [
          { weekday: 0, periods: [{ start: '08:30', end: '17:00' }] },
          { weekday: 1, periods: [{ start: '08:30', end: '17:00' }] },
          { weekday: 2, periods: [{ start: '08:30', end: '17:00' }] },
          { weekday: 3, periods: [{ start: '08:30', end: '17:00' }] },
          { weekday: 4, periods: [{ start: '08:30', end: '17:00' }] },
          { weekday: 5, periods: [{ start: '08:30', end: '17:00' }] },
          { weekday: 6, periods: [{ start: '08:30', end: '17:00' }] },
        ],
        lastEntryTime: '16:00',
        reservationRequired: true,
        reservationCutoffMinutes: 120,
        reservationTimeSlotsJson: ['09:00', '11:00', '13:00'],
        queueProfileJson: {
          weekdayMinutes: 20,
          weekendMinutes: 45,
          holidayMinutes: 80,
        },
        bestVisitWindowsJson: [
          { start: '08:45', end: '10:30', tag: 'morning' },
        ],
      },
      {
        name: 'Temple of Heaven',
        entryLatitude: 39.8822,
        entryLongitude: 116.4065,
        exitLatitude: 39.8789,
        exitLongitude: 116.4122,
        suggestedDurationMinutes: 150,
        openingHoursJson: [
          { weekday: 0, periods: [{ start: '06:30', end: '20:30' }] },
          { weekday: 1, periods: [{ start: '06:30', end: '20:30' }] },
          { weekday: 2, periods: [{ start: '06:30', end: '20:30' }] },
          { weekday: 3, periods: [{ start: '06:30', end: '20:30' }] },
          { weekday: 4, periods: [{ start: '06:30', end: '20:30' }] },
          { weekday: 5, periods: [{ start: '06:30', end: '20:30' }] },
          { weekday: 6, periods: [{ start: '06:30', end: '20:30' }] },
        ],
        lastEntryTime: '19:30',
        queueProfileJson: {
          weekdayMinutes: 10,
          weekendMinutes: 20,
          holidayMinutes: 40,
        },
        bestVisitWindowsJson: [
          { start: '07:00', end: '09:00', tag: 'morning' },
        ],
      },
    ],
    shopping: [
      {
        name: 'Wangfujing Street',
        latitude: 39.9154,
        longitude: 116.4103,
        suggestedDurationMinutes: 120,
        arrivalAnchorLatitude: 39.9157,
        arrivalAnchorLongitude: 116.4098,
        departureAnchorLatitude: 39.9148,
        departureAnchorLongitude: 116.4114,
        openingHoursJson: [
          { weekday: 0, periods: [{ start: '10:00', end: '22:00' }] },
          { weekday: 1, periods: [{ start: '10:00', end: '22:00' }] },
          { weekday: 2, periods: [{ start: '10:00', end: '22:00' }] },
          { weekday: 3, periods: [{ start: '10:00', end: '22:00' }] },
          { weekday: 4, periods: [{ start: '10:00', end: '22:30' }] },
          { weekday: 5, periods: [{ start: '10:00', end: '22:30' }] },
          { weekday: 6, periods: [{ start: '10:00', end: '22:00' }] },
        ],
      },
      {
        name: 'Sanlitun Taikooli',
        latitude: 39.9366,
        longitude: 116.4549,
        suggestedDurationMinutes: 150,
        arrivalAnchorLatitude: 39.9362,
        arrivalAnchorLongitude: 116.4541,
        departureAnchorLatitude: 39.9373,
        departureAnchorLongitude: 116.4558,
        openingHoursJson: [
          { weekday: 0, periods: [{ start: '10:00', end: '22:00' }] },
          { weekday: 1, periods: [{ start: '10:00', end: '22:00' }] },
          { weekday: 2, periods: [{ start: '10:00', end: '22:00' }] },
          { weekday: 3, periods: [{ start: '10:00', end: '22:00' }] },
          { weekday: 4, periods: [{ start: '10:00', end: '22:30' }] },
          { weekday: 5, periods: [{ start: '10:00', end: '22:30' }] },
          { weekday: 6, periods: [{ start: '10:00', end: '22:00' }] },
        ],
      },
    ],
    restaurants: [
      {
        name: 'Quanjude Qianmen',
        latitude: 39.8954,
        longitude: 116.4049,
        suggestedDurationMinutes: 90,
        mealSlots: ['lunch', 'dinner'],
        arrivalAnchorLatitude: 39.8956,
        arrivalAnchorLongitude: 116.4043,
        departureAnchorLatitude: 39.8951,
        departureAnchorLongitude: 116.4055,
        mealTimeWindowsJson: [
          { mealSlot: 'lunch', start: '11:00', end: '14:00' },
          { mealSlot: 'dinner', start: '17:00', end: '21:00' },
        ],
        queueProfileJson: {
          weekdayMinutes: 12,
          weekendMinutes: 25,
          holidayMinutes: 40,
        },
      },
      {
        name: 'Donglaishun Wangfujing',
        latitude: 39.9148,
        longitude: 116.4118,
        suggestedDurationMinutes: 90,
        mealSlots: ['lunch', 'dinner'],
        arrivalAnchorLatitude: 39.915,
        arrivalAnchorLongitude: 116.4113,
        departureAnchorLatitude: 39.9145,
        departureAnchorLongitude: 116.4124,
        mealTimeWindowsJson: [
          { mealSlot: 'lunch', start: '11:00', end: '14:30' },
          { mealSlot: 'dinner', start: '17:00', end: '21:30' },
        ],
        queueProfileJson: {
          weekdayMinutes: 10,
          weekendMinutes: 18,
          holidayMinutes: 30,
        },
      },
    ],
    hotels: [
      {
        name: 'Beijing Hotel NUO',
        latitude: 39.9079,
        longitude: 116.4157,
        starLevel: 5,
        bookingUrl: 'https://www.trip.com/hotels/',
        foreignerFriendly: true,
        checkInTime: '15:00',
        checkOutTime: '12:00',
        arrivalAnchorLatitude: 39.9082,
        arrivalAnchorLongitude: 116.4152,
        departureAnchorLatitude: 39.9076,
        departureAnchorLongitude: 116.4161,
        bookingStatus: 'available',
        bookableDatesJson: ['2026-07-15', '2026-07-16', '2026-07-17'],
        pricePerNightMinCny: 980,
        pricePerNightMaxCny: 1480,
      },
      {
        name: 'Novotel Beijing Peace',
        latitude: 39.9142,
        longitude: 116.4172,
        starLevel: 4,
        bookingUrl: 'https://www.trip.com/hotels/',
        foreignerFriendly: true,
        checkInTime: '14:00',
        checkOutTime: '12:00',
        arrivalAnchorLatitude: 39.9145,
        arrivalAnchorLongitude: 116.4167,
        departureAnchorLatitude: 39.9138,
        departureAnchorLongitude: 116.4178,
        bookingStatus: 'limited',
        bookableDatesJson: ['2026-07-15', '2026-07-16'],
        pricePerNightMinCny: 680,
        pricePerNightMaxCny: 980,
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
        arrivalBufferMinutes: 35,
        departureBufferMinutes: 90,
        arrivalAnchorLatitude: 47.6472,
        arrivalAnchorLongitude: 106.8191,
        departureAnchorLatitude: 47.6463,
        departureAnchorLongitude: 106.8205,
      },
    ],
    spots: [
      {
        name: 'Gandantegchinlen Monastery',
        entryLatitude: 47.9221,
        entryLongitude: 106.8945,
        exitLatitude: 47.9212,
        exitLongitude: 106.8961,
        suggestedDurationMinutes: 120,
        openingHoursJson: [
          { weekday: 0, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 1, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 2, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 3, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 4, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 5, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 6, periods: [{ start: '09:00', end: '18:00' }] },
        ],
        lastEntryTime: '17:00',
        queueProfileJson: {
          weekdayMinutes: 5,
          weekendMinutes: 12,
          holidayMinutes: 20,
        },
      },
      {
        name: 'Bogd Khan Palace Museum',
        entryLatitude: 47.8999,
        entryLongitude: 106.9057,
        exitLatitude: 47.8991,
        exitLongitude: 106.9072,
        suggestedDurationMinutes: 120,
        openingHoursJson: [
          { weekday: 1, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 2, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 3, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 4, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 5, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 6, periods: [{ start: '09:00', end: '18:00' }] },
        ],
        lastEntryTime: '16:30',
        reservationRequired: false,
        queueProfileJson: {
          weekdayMinutes: 6,
          weekendMinutes: 15,
          holidayMinutes: 25,
        },
      },
    ],
    shopping: [
      {
        name: 'State Department Store Ulaanbaatar',
        latitude: 47.9181,
        longitude: 106.9179,
        suggestedDurationMinutes: 120,
        arrivalAnchorLatitude: 47.9184,
        arrivalAnchorLongitude: 106.9172,
        departureAnchorLatitude: 47.9177,
        departureAnchorLongitude: 106.9185,
        openingHoursJson: [
          { weekday: 0, periods: [{ start: '10:00', end: '21:00' }] },
          { weekday: 1, periods: [{ start: '10:00', end: '21:00' }] },
          { weekday: 2, periods: [{ start: '10:00', end: '21:00' }] },
          { weekday: 3, periods: [{ start: '10:00', end: '21:00' }] },
          { weekday: 4, periods: [{ start: '10:00', end: '21:00' }] },
          { weekday: 5, periods: [{ start: '10:00', end: '21:00' }] },
          { weekday: 6, periods: [{ start: '10:00', end: '21:00' }] },
        ],
      },
      {
        name: 'Narantuul Market',
        latitude: 47.9227,
        longitude: 106.9385,
        suggestedDurationMinutes: 120,
        arrivalAnchorLatitude: 47.923,
        arrivalAnchorLongitude: 106.9378,
        departureAnchorLatitude: 47.9223,
        departureAnchorLongitude: 106.9392,
        openingHoursJson: [
          { weekday: 1, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 2, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 3, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 4, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 5, periods: [{ start: '09:00', end: '18:00' }] },
          { weekday: 6, periods: [{ start: '09:00', end: '18:00' }] },
        ],
      },
    ],
    restaurants: [
      {
        name: 'Modern Nomads UB',
        latitude: 47.9177,
        longitude: 106.9165,
        suggestedDurationMinutes: 90,
        mealSlots: ['lunch', 'dinner'],
        arrivalAnchorLatitude: 47.9179,
        arrivalAnchorLongitude: 106.9159,
        departureAnchorLatitude: 47.9174,
        departureAnchorLongitude: 106.917,
        mealTimeWindowsJson: [
          { mealSlot: 'lunch', start: '11:30', end: '14:30' },
          { mealSlot: 'dinner', start: '17:30', end: '21:30' },
        ],
        queueProfileJson: {
          weekdayMinutes: 8,
          weekendMinutes: 15,
          holidayMinutes: 25,
        },
      },
      {
        name: 'Hazara Indian Restaurant UB',
        latitude: 47.9134,
        longitude: 106.9143,
        suggestedDurationMinutes: 90,
        mealSlots: ['lunch', 'dinner'],
        arrivalAnchorLatitude: 47.9137,
        arrivalAnchorLongitude: 106.9137,
        departureAnchorLatitude: 47.913,
        departureAnchorLongitude: 106.9149,
        mealTimeWindowsJson: [
          { mealSlot: 'lunch', start: '11:00', end: '14:00' },
          { mealSlot: 'dinner', start: '17:00', end: '21:00' },
        ],
        queueProfileJson: {
          weekdayMinutes: 6,
          weekendMinutes: 12,
          holidayMinutes: 20,
        },
      },
    ],
    hotels: [
      {
        name: 'Shangri-La Ulaanbaatar',
        latitude: 47.9143,
        longitude: 106.9156,
        starLevel: 5,
        bookingUrl: 'https://www.trip.com/hotels/',
        foreignerFriendly: true,
        checkInTime: '14:00',
        checkOutTime: '12:00',
        arrivalAnchorLatitude: 47.9146,
        arrivalAnchorLongitude: 106.9151,
        departureAnchorLatitude: 47.9139,
        departureAnchorLongitude: 106.9161,
        bookingStatus: 'available',
        bookableDatesJson: ['2026-07-15', '2026-07-16', '2026-07-17'],
        pricePerNightMinCny: 780,
        pricePerNightMaxCny: 1180,
      },
      {
        name: 'Best Western Premier Tuushin Hotel',
        latitude: 47.9188,
        longitude: 106.9172,
        starLevel: 4,
        bookingUrl: 'https://www.trip.com/hotels/',
        foreignerFriendly: true,
        checkInTime: '14:00',
        checkOutTime: '12:00',
        arrivalAnchorLatitude: 47.919,
        arrivalAnchorLongitude: 106.9167,
        departureAnchorLatitude: 47.9185,
        departureAnchorLongitude: 106.9178,
        bookingStatus: 'limited',
        bookableDatesJson: ['2026-07-15', '2026-07-16'],
        pricePerNightMinCny: 520,
        pricePerNightMaxCny: 760,
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
      existing.arrivalBufferMinutes = airport.arrivalBufferMinutes;
      existing.departureBufferMinutes = airport.departureBufferMinutes;
      existing.arrivalAnchorLatitude = airport.arrivalAnchorLatitude;
      existing.arrivalAnchorLongitude = airport.arrivalAnchorLongitude;
      existing.departureAnchorLatitude = airport.departureAnchorLatitude;
      existing.departureAnchorLongitude = airport.departureAnchorLongitude;
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
        arrivalBufferMinutes: airport.arrivalBufferMinutes,
        departureBufferMinutes: airport.departureBufferMinutes,
        arrivalAnchorLatitude: airport.arrivalAnchorLatitude,
        arrivalAnchorLongitude: airport.arrivalAnchorLongitude,
        departureAnchorLatitude: airport.departureAnchorLatitude,
        departureAnchorLongitude: airport.departureAnchorLongitude,
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
      entryLatitude: spot.entryLatitude,
      entryLongitude: spot.entryLongitude,
      exitLatitude: spot.exitLatitude,
      exitLongitude: spot.exitLongitude,
      introI18n: buildI18n(`${spot.name} intro`),
      guideI18n: buildI18n(`${spot.name} guide`),
      openingHoursJson: spot.openingHoursJson,
      specialClosureDates: null,
      lastEntryTime: spot.lastEntryTime,
      suggestedDurationMinutes: spot.suggestedDurationMinutes,
      reservationRequired: spot.reservationRequired ?? false,
      isPublished: true,
      coverImageUrl: null,
      reservationUrl: null,
      reservationCutoffMinutes: spot.reservationCutoffMinutes ?? null,
      reservationTimeSlotsJson: spot.reservationTimeSlotsJson ?? null,
      reservationNoteI18n: null,
      closedWeekdays: null,
      queueProfileJson: spot.queueProfileJson ?? null,
      bestVisitWindowsJson: spot.bestVisitWindowsJson ?? null,
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
      arrivalAnchorLatitude: item.arrivalAnchorLatitude,
      arrivalAnchorLongitude: item.arrivalAnchorLongitude,
      departureAnchorLatitude: item.departureAnchorLatitude,
      departureAnchorLongitude: item.departureAnchorLongitude,
      introI18n: buildI18n(`${item.name} intro`),
      guideI18n: buildI18n(`${item.name} guide`),
      openingHours: '10:00-22:00',
      openingHoursJson: item.openingHoursJson,
      specialClosureDates: null,
      suggestedDurationMinutes: item.suggestedDurationMinutes,
      queueProfileJson: {
        weekdayMinutes: 5,
        weekendMinutes: 12,
        holidayMinutes: 18,
      },
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
      arrivalAnchorLatitude: item.arrivalAnchorLatitude,
      arrivalAnchorLongitude: item.arrivalAnchorLongitude,
      departureAnchorLatitude: item.departureAnchorLatitude,
      departureAnchorLongitude: item.departureAnchorLongitude,
      introI18n: buildI18n(`${item.name} intro`),
      guideI18n: buildI18n(`${item.name} guide`),
      openingHours: '11:00-21:30',
      suggestedDurationMinutes: item.suggestedDurationMinutes,
      mealSlots: item.mealSlots,
      mealTimeWindowsJson: item.mealTimeWindowsJson,
      cuisineTags: ['signature'],
      reservationRequired: false,
      reservationUrl: null,
      queueProfileJson: item.queueProfileJson ?? null,
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
      arrivalAnchorLatitude: item.arrivalAnchorLatitude,
      arrivalAnchorLongitude: item.arrivalAnchorLongitude,
      departureAnchorLatitude: item.departureAnchorLatitude,
      departureAnchorLongitude: item.departureAnchorLongitude,
      introI18n: buildI18n(`${item.name} intro`),
      guideI18n: buildI18n(`${item.name} guide`),
      starLevel: item.starLevel,
      foreignerFriendly: item.foreignerFriendly,
      checkInTime: item.checkInTime,
      checkOutTime: item.checkOutTime,
      bookingUrl: item.bookingUrl,
      bookingStatus: item.bookingStatus,
      bookableDatesJson: item.bookableDatesJson,
      pricePerNightMinCny: item.pricePerNightMinCny,
      pricePerNightMaxCny: item.pricePerNightMaxCny,
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
