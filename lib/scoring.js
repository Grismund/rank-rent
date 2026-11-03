export function scoreSearchVolume(volume) {
  if (volume > 500) return 2
  if (volume >= 200) return 1
  return 0
}

export function scoreCPC(cpc) {
  if (cpc > 40) return 2
  if (cpc >= 10) return 1
  return 0
}

export function scoreMapPackWeakness(topThree) {
  if (topThree.length < 3) return 2
  const weakCount = topThree.filter(
    (b) => b.reviews < 50 || b.rating < 4.0
  ).length
  if (weakCount === 3) return 2
  if (weakCount >= 1) return 1
  return 0
}

export function scoreOrganicWeakness(topFive, directoryDomains) {
  const dirCount = topFive.filter((domain) =>
    directoryDomains.some((dir) => domain === dir || domain.endsWith(`.${dir}`))
  ).length
  if (dirCount >= 4) return 2
  if (dirCount >= 2) return 1
  return 0
}

export function scoreRenterAvailability(count) {
  if (count > 15) return 2
  if (count >= 5) return 1
  return 0
}

export function scoreLicenseBarrier(barrier) {
  if (barrier === 'required') return 0
  if (barrier === 'partial') return 1
  return 2
}

export function scoreSeasonality(monthlyValues) {
  if (monthlyValues.length <= 1) return 2
  const peak = Math.max(...monthlyValues)
  if (peak === 0) return 2
  const lowMonths = monthlyValues.filter((v) => v < peak * 0.3).length
  const moderateMonths = monthlyValues.filter(
    (v) => v >= peak * 0.3 && v < peak * 0.6
  ).length
  if (lowMonths >= 4) return 0
  if (moderateMonths >= 2 || lowMonths >= 1) return 1
  return 2
}

export function estimateRent(volume, cpc) {
  return volume * 0.15 * 0.10 * cpc * 7.5 / 2
}

export function scoreRentPotential(rentEstimate) {
  if (rentEstimate > 500) return 2
  if (rentEstimate >= 200) return 1
  return 0
}

export function totalScore(signals) {
  const total =
    signals.volume +
    signals.cpc +
    signals.mapPack +
    signals.organic +
    signals.renters +
    signals.license +
    signals.seasonality +
    signals.rent
  let status
  if (total >= 11) status = 'pass'
  else if (total >= 8) status = 'marginal'
  else status = 'walk_away'
  return { total, status }
}
