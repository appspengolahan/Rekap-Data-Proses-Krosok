import {
  FactoryLocation,
  FactoryWeatherData,
  HourlyWeatherPoint,
  HygroAnalysis
} from '../types';

export const PP1_FACTORY_LOCATIONS: FactoryLocation[] = [
  {
    id: 'batu-karang-wagir',
    name: 'PT BATU KARANG (Pabrik Sentral Wagir)',
    region: 'Kab. Malang, Jawa Timur',
    address:
      'Jl. Parangargo No.153, Genengan, Parangargo, Kec. Wagir, Kabupaten Malang, Jawa Timur 65158',
    lat: -8.0175,
    lon: 112.5939,
    elevationM: 465,
    isDefault: true
  },
  {
    id: 'bojonegoro',
    name: 'Unit Bojonegoro (BKR)',
    region: 'Jawa Timur',
    address: 'Unit Pengolahan Bojonegoro, Jawa Timur',
    lat: -7.15,
    lon: 111.88
  },
  {
    id: 'ploso',
    name: 'Unit Jombang / Ploso (MYN)',
    region: 'Jawa Timur',
    address: 'Unit Pengolahan Ploso, Jombang, Jawa Timur',
    lat: -7.45,
    lon: 112.23
  },
  {
    id: 'madura',
    name: 'Unit Madura / Pamekasan (BAT)',
    region: 'Jawa Timur',
    address: 'Unit Pengolahan Pamekasan, Madura, Jawa Timur',
    lat: -7.16,
    lon: 113.48
  }
];

const WEATHER_STORAGE_KEYS = {
  LOCATION_ID: 'krosok_active_factory_loc_v1',
  CACHE_PREFIX: 'krosok_weather_cache_v1'
};

export function getSelectedFactoryLocation(): FactoryLocation {
  try {
    const savedId = localStorage.getItem(WEATHER_STORAGE_KEYS.LOCATION_ID);
    if (savedId) {
      const found = PP1_FACTORY_LOCATIONS.find((l) => l.id === savedId);
      if (found) return found;
    }
  } catch {
    // ignore storage errors
  }
  return PP1_FACTORY_LOCATIONS[0];
}

export function setSelectedFactoryLocation(locationId: string): FactoryLocation {
  const found =
    PP1_FACTORY_LOCATIONS.find((l) => l.id === locationId) || PP1_FACTORY_LOCATIONS[0];
  try {
    localStorage.setItem(WEATHER_STORAGE_KEYS.LOCATION_ID, found.id);
  } catch {
    // ignore
  }
  return found;
}

export function decodeWeatherCode(code: number): string {
  switch (code) {
    case 0:
      return 'Cerah Terang';
    case 1:
      return 'Sebagian Besar Cerah';
    case 2:
      return 'Cerah Berawan';
    case 3:
      return 'Mendung / Berawan Tebal';
    case 45:
    case 48:
      return 'Berkabut Lembab';
    case 51:
    case 53:
    case 55:
      return 'Gerimis Ringan';
    case 61:
    case 63:
      return 'Hujan Sedang';
    case 65:
      return 'Hujan Deras';
    case 80:
    case 81:
    case 82:
      return 'Hujan Lokal';
    case 95:
    case 96:
    case 99:
      return 'Hujan Disertai Petir';
    default:
      return 'Cerah Berawan';
  }
}

export function isRainWeatherCode(code: number): boolean {
  return [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code);
}

export function computeHygroIndex(
  temperature: number,
  humidity: number,
  weatherCode: number,
  precipitation: number = 0
): HygroAnalysis {
  const isRaining = isRainWeatherCode(weatherCode) || precipitation > 0.2;

  if (temperature >= 32.5 || (temperature >= 30.5 && humidity <= 52)) {
    return {
      status: 'Panas Ekstrem',
      potensiPenguapan: 'Tinggi',
      resikoDebu: 'Tinggi',
      analisisKorelasi: `Suhu tinggi (${temperature.toFixed(1)}°C) dengan RH rendah (${Math.round(humidity)}%) mempercepat penguapan air alami daun krosok dan membuat lembaran daun lebih getas sehingga potensi susut & serpihan debu meningkat.`,
      rekomendasiOperasional:
        'Jaga kelembaban ruang proses (conditioning/spray halus bila diperlukan) dan minimalkan jeda eksposur bal krosok terbuka sebelum penimbangan hasil.'
    };
  }

  if (temperature >= 29.5 && humidity <= 60) {
    return {
      status: 'Kering & Panas',
      potensiPenguapan: 'Tinggi',
      resikoDebu: 'Tinggi',
      analisisKorelasi: `Udara relatif kering (${Math.round(humidity)}% RH pada ${temperature.toFixed(1)}°C) mendorong pelepasan uap air dari krosok simpanan lama, berpotensi menaikkan % susut di atas acuan.`,
      rekomendasiOperasional:
        'Pantau seting kecepatan bukaan/pemisahan mesin agar krosok kering tidak pecah menjadi fraksi debu halus.'
    };
  }

  if (isRaining || humidity >= 78) {
    return {
      status: 'Lembab / Hujan',
      potensiPenguapan: 'Rendah',
      resikoDebu: 'Rendah',
      analisisKorelasi: `Kelembaban udara Wagir tinggi (${Math.round(humidity)}% RH${isRaining ? ', kondisi hujan' : ''}). Sifat higroskopis krosok menyerap uap air sehingga susut cenderung sangat rendah atau negatif (pertambahan bobot).`,
      rekomendasiOperasional:
        'Waspadai over-moisture pada krosok hasil olah (terutama susut minus berlebih) agar aman dari risiko jamur saat penyimpanan.'
    };
  }

  return {
    status: 'Optimal',
    potensiPenguapan: 'Normal',
    resikoDebu: 'Normal',
    analisisKorelasi: `Mikroklimat lokasi pabrik (${temperature.toFixed(1)}°C · RH ${Math.round(humidity)}%) berada pada zona seimbang pengolahan krosok. Deviasi susut yang muncul murni mencerminkan karakter fisik bahan baku & perlakuan mesin.`,
    rekomendasiOperasional:
      'Pertahankan parameter operasional standar sesuai jalur proses SKT/SKM tanpa kompensasi cuaca khusus.'
  };
}

export async function fetchFactoryWeather(
  locationOverride?: FactoryLocation,
  forceRefresh: boolean = false
): Promise<FactoryWeatherData> {
  const loc = locationOverride || getSelectedFactoryLocation();
  const cacheKey = `${WEATHER_STORAGE_KEYS.CACHE_PREFIX}_${loc.id}`;

  if (!forceRefresh) {
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const cached: FactoryWeatherData = JSON.parse(raw);
        const ageMinutes =
          (Date.now() - new Date(cached.fetchedAt).getTime()) / (1000 * 60);
        if (ageMinutes < 15 && Array.isArray(cached.hourly)) {
          return cached;
        }
      }
    } catch {
      // ignore cache parse errors
    }
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
      `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,is_day` +
      `&hourly=temperature_2m,relative_humidity_2m,weather_code,precipitation` +
      `&past_days=14&forecast_days=1&timezone=Asia%2FJakarta`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Open-Meteo HTTP ${res.status}`);
    }

    const json = await res.json();
    const cur = json.current || {};
    const temp = Number(cur.temperature_2m ?? 26.8);
    const rh = Number(cur.relative_humidity_2m ?? 72);
    const wCode = Number(cur.weather_code ?? 2);
    const wind = Number(cur.wind_speed_10m ?? 5.4);
    const precip = Number(cur.precipitation ?? 0);
    const isDay = cur.is_day === 1;

    const times: string[] = json.hourly?.time || [];
    const hTemps: number[] = json.hourly?.temperature_2m || [];
    const hRhs: number[] = json.hourly?.relative_humidity_2m || [];
    const hCodes: number[] = json.hourly?.weather_code || [];
    const hPrecips: number[] = json.hourly?.precipitation || [];

    const hourly: HourlyWeatherPoint[] = [];
    const rainyDaySet = new Set<string>();
    let sumTemp = 0;
    let sumRh = 0;

    for (let i = 0; i < times.length; i++) {
      const tVal = Number(hTemps[i] ?? temp);
      const rVal = Number(hRhs[i] ?? rh);
      const cVal = Number(hCodes[i] ?? wCode);
      const pVal = Number(hPrecips[i] ?? 0);
      hourly.push({
        timeIso: times[i],
        temperature: tVal,
        humidity: rVal,
        weatherCode: cVal,
        precipitation: pVal,
        weatherDesc: decodeWeatherCode(cVal)
      });
      sumTemp += tVal;
      sumRh += rVal;
      if (pVal >= 1.0 || isRainWeatherCode(cVal)) {
        const dayStr = times[i].split('T')[0];
        if (dayStr) rainyDaySet.add(dayStr);
      }
    }

    const count = hourly.length || 1;
    const data: FactoryWeatherData = {
      location: loc,
      temperature: temp,
      humidity: rh,
      weatherCode: wCode,
      weatherDesc: decodeWeatherCode(wCode),
      windSpeed: wind,
      precipitation: precip,
      isDay,
      fetchedAt: new Date().toISOString(),
      hygroIndex: computeHygroIndex(temp, rh, wCode, precip),
      hourly,
      rainyDaysLast14d: rainyDaySet.size,
      avgHumidityLast14d: Math.round((sumRh / count) * 10) / 10,
      avgTempLast14d: Math.round((sumTemp / count) * 10) / 10
    };

    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch {
      // ignore quota errors
    }

    return data;
  } catch (err) {
    console.warn('Weather API fallback notice (using Wagir microclimate baseline):', err);
    const fallbackTemp = 26.8;
    const fallbackRh = 73;
    return {
      location: loc,
      temperature: fallbackTemp,
      humidity: fallbackRh,
      weatherCode: 2,
      weatherDesc: 'Cerah Berawan (Estimasi Iklim Wagir)',
      windSpeed: 5.8,
      precipitation: 0,
      isDay: true,
      fetchedAt: new Date().toISOString(),
      hygroIndex: computeHygroIndex(fallbackTemp, fallbackRh, 2, 0),
      hourly: [],
      rainyDaysLast14d: 4,
      avgHumidityLast14d: 74.5,
      avgTempLast14d: 25.9
    };
  }
}

/**
 * Matches exact processing hour from DHP `waktu` (e.g. "14:52 - 14:53" or "09:21 - 09:37")
 * against Open-Meteo hourly history for the batch date.
 */
export function getBatchHourlyWeather(
  weatherData: FactoryWeatherData | null | undefined,
  tanggalIso: string,
  waktuStr?: string
): HourlyWeatherPoint | null {
  if (!weatherData) return null;

  let targetHour = 11; // default midday production hour if waktu not recorded
  if (waktuStr) {
    const match = waktuStr.match(/(\d{1,2})[:.](\d{2})/);
    if (match) {
      const hh = parseInt(match[1], 10);
      const mm = parseInt(match[2], 10);
      targetHour = mm >= 40 ? Math.min(23, hh + 1) : hh;
    }
  }

  const targetKey = `${tanggalIso}T${String(targetHour).padStart(2, '0')}:00`;
  if (weatherData.hourly && weatherData.hourly.length > 0) {
    const exact = weatherData.hourly.find((h) => h.timeIso === targetKey);
    if (exact) return exact;

    // Fallback to same hour on latest available day if batch date is outside 14-day window
    const sameHourSuffix = `T${String(targetHour).padStart(2, '0')}:00`;
    const recentSameHour = [...weatherData.hourly]
      .reverse()
      .find((h) => h.timeIso.endsWith(sameHourSuffix));
    if (recentSameHour) {
      return {
        ...recentSameHour,
        timeIso: targetKey
      };
    }
  }

  return {
    timeIso: targetKey,
    temperature: weatherData.temperature,
    humidity: weatherData.humidity,
    weatherCode: weatherData.weatherCode,
    precipitation: weatherData.precipitation,
    weatherDesc: weatherData.weatherDesc
  };
}
