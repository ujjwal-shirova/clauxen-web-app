/**
 * Open-Meteo integration — free, keyless weather + geocoding API that
 * aggregates official national weather models (NOAA GFS, ECMWF, DWD ICON,
 * etc). No Google Maps, no paid tier, no API key required.
 * https://open-meteo.com/en/docs
 */

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

export type GeocodedPlace = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type GeocodeApiRow = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

export async function geocodeLocation(
  query: string,
): Promise<GeocodedPlace | null> {
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: GeocodeApiRow[] };
  const hit = data.results?.[0];
  if (!hit) return null;
  return {
    name: hit.name,
    country: hit.country,
    admin1: hit.admin1,
    latitude: hit.latitude,
    longitude: hit.longitude,
    timezone: hit.timezone,
  };
}

/** WMO weather interpretation codes (standard meteorological vocabulary — used by Open-Meteo and most national weather services). */
const WMO_CONDITION: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  56: "Light freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Light freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  85: "Light snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with light hail",
  99: "Thunderstorm with heavy hail",
};

export function weatherConditionLabel(code: number): string {
  return WMO_CONDITION[code] ?? "Unknown";
}

export type WeatherUnits = "metric" | "imperial";

export type WeatherForecast = {
  place: GeocodedPlace;
  units: WeatherUnits;
  current: {
    time: string;
    temperature: number;
    feelsLike: number;
    humidity: number;
    isDay: boolean;
    weatherCode: number;
    condition: string;
    windSpeed: number;
    windDirection: number;
    windGusts: number;
    precipitation: number;
  };
  hourly: Array<{
    time: string;
    temperature: number;
    precipitationProbability: number;
    weatherCode: number;
    condition: string;
  }>;
  daily: Array<{
    date: string;
    weatherCode: number;
    condition: string;
    tempMax: number;
    tempMin: number;
    precipitationProbability: number;
    windSpeedMax: number;
    sunrise: string;
    sunset: string;
    uvIndexMax?: number;
  }>;
};

/** Index range for the next `count` hours starting at the current hour. */
function upcomingHoursRange(times: string[], nowIso: string, count: number) {
  const startIndex = Math.max(0, times.findIndex((t) => t >= nowIso.slice(0, 13)));
  return { startIndex, endIndex: Math.min(times.length, startIndex + count) };
}

export async function fetchWeatherForecast(
  place: GeocodedPlace,
  units: WeatherUnits = "metric",
): Promise<WeatherForecast> {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "is_day",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
      "wind_gusts_10m",
    ].join(","),
    hourly: "temperature_2m,precipitation_probability,weather_code",
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "sunrise",
      "sunset",
      "precipitation_probability_max",
      "wind_speed_10m_max",
      "uv_index_max",
    ].join(","),
    timezone: place.timezone || "auto",
    forecast_days: "7",
    temperature_unit: units === "imperial" ? "fahrenheit" : "celsius",
    wind_speed_unit: units === "imperial" ? "mph" : "kmh",
    precipitation_unit: units === "imperial" ? "inch" : "mm",
  });

  const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Open-Meteo forecast request failed (${res.status})`);
  }

  const data = (await res.json()) as {
    current: {
      time: string;
      temperature_2m: number;
      relative_humidity_2m: number;
      apparent_temperature: number;
      is_day: number;
      precipitation: number;
      weather_code: number;
      wind_speed_10m: number;
      wind_direction_10m: number;
      wind_gusts_10m: number;
    };
    hourly: {
      time: string[];
      temperature_2m: number[];
      precipitation_probability: number[];
      weather_code: number[];
    };
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      sunrise: string[];
      sunset: string[];
      precipitation_probability_max: number[];
      wind_speed_10m_max: number[];
      uv_index_max?: number[];
    };
  };

  const { startIndex, endIndex } = upcomingHoursRange(
    data.hourly.time,
    data.current.time,
    24,
  );

  return {
    place,
    units,
    current: {
      time: data.current.time,
      temperature: data.current.temperature_2m,
      feelsLike: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      isDay: data.current.is_day === 1,
      weatherCode: data.current.weather_code,
      condition: weatherConditionLabel(data.current.weather_code),
      windSpeed: data.current.wind_speed_10m,
      windDirection: data.current.wind_direction_10m,
      windGusts: data.current.wind_gusts_10m,
      precipitation: data.current.precipitation,
    },
    hourly: data.hourly.time
      .slice(startIndex, endIndex)
      .map((time, i) => {
        const idx = startIndex + i;
        return {
          time,
          temperature: data.hourly.temperature_2m[idx],
          precipitationProbability: data.hourly.precipitation_probability[idx] ?? 0,
          weatherCode: data.hourly.weather_code[idx],
          condition: weatherConditionLabel(data.hourly.weather_code[idx]),
        };
      }),
    daily: data.daily.time.map((date, i) => ({
      date,
      weatherCode: data.daily.weather_code[i],
      condition: weatherConditionLabel(data.daily.weather_code[i]),
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      precipitationProbability: data.daily.precipitation_probability_max[i] ?? 0,
      windSpeedMax: data.daily.wind_speed_10m_max[i],
      sunrise: data.daily.sunrise[i],
      sunset: data.daily.sunset[i],
      uvIndexMax: data.daily.uv_index_max?.[i],
    })),
  };
}
