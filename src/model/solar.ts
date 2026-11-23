import SunCalc from 'suncalc';

export function solarWindow(
  latitude: unknown,
  longitude: unknown,
  now = new Date(),
) {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return;
  const { sunrise, sunset } = SunCalc.getTimes(now, latitude, longitude);
  return {
    sunrise: Number.isFinite(+sunrise) ? sunrise.toISOString() : null,
    sunset: Number.isFinite(+sunset) ? sunset.toISOString() : null,
    nighttime:
      SunCalc.getPosition(now, latitude, longitude).altitude <
      (-0.833 * Math.PI) / 180,
  };
}
