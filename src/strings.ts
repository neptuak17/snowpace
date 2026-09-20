/**
 * Every piece of user-facing copy in the app, in one place.
 *
 * Grouped by screen, then by the shared engine text at the bottom. Anything
 * with a value plugged in is a function. Data names (places, regions,
 * activities) live in data/places.ts; unit symbols live in lib/format.ts.
 */

const activities = {
  classic: 'Classic',
  skate: 'Skate',
  snowshoe: 'Snowshoe',
  downhill: 'Downhill',
} as const;

const activityNotes = {
  classic: 'Groomed trackset',
  skate: 'Groomed skate lane',
  snowshoe: 'Groomed and natural trails',
  downhill: 'Lift-served skiing and snowboarding',
} as const;

export const strings = {
  appName: 'Snowpace',

  activities,
  activityNotes,

  tabs: {
    today: 'Today',
    forecast: 'Forecast',
    places: 'My places',
    you: 'You',
  },

  common: {
    back: 'Back',
    backTo: (label: string) => `‹ ${label}`,
    help: 'Help',
    home: 'Home',
    chevron: '›',
    dash: '—',
    siteLink: (name: string) => `${name} web site ↗`,
    away: (distance: string) => `${distance} away`,
    forecastAge: (age: string) => `Forecast ${age}`,
    placeMeta: (parts: (string | null)[]) => parts.filter(Boolean).join(' · '),
    placeMetaAway: (parts: (string | null)[], distance: string) => [...parts.filter(Boolean), `${distance} away`].join(' · '),
    elevation: (lo: string, hi: string) => `${lo}–${hi}`,
    unlisted: 'No longer listed',
    remove: 'Remove',
    chipWithScore: (label: string, score: string) => `${label} ${score}`,
    toggleBreakdown: 'Toggle breakdown',
  },

  today: {
    noActivityKicker: (activity: string) => `No ${activity} here`,
    noActivityBody: (verdict: string) =>
      `${verdict} The places below do — or switch activity to see how it is looking at your home hill.`,
    whereCanIGo: 'Where can I go?',
    hideBreakdown: 'Hide the breakdown ›',
    showBreakdown: (hour: string) => `Breakdown for ${hour} ›`,
    breakdownKicker: (hour: string) => `Breakdown for ${hour}`,
    dialLine: (hour: string, band: string) => `${hour} · ${band}`,
    bestWindow: 'Best window today',
    bestLabel: (range: string) => `Best ${range}`,
    barLabel: (hour: string, score: number) => `${hour}, score ${score}`,
    otherActivitiesAt: (name: string) => `Other activities at ${name}`,
    otherNearby: 'Other options nearby',
    seeAll: 'See all',
    noAlternatives: (activity: string, distance: string) =>
      `None of your other places offer ${activity} within ${distance}.`,
    noForecastKicker: 'No forecast yet',
    noForecastBody: 'The mountain forecast for this place has not been fetched yet. It will be tried again when you next open the app.',
    noHomeKicker: 'No home hill yet',
    noHomeBody: 'Add the places you go to and pick one as your home hill — that is the one this screen opens on.',
    addPlaces: 'Add your places',
  },

  forecast: {
    title: 'Next five days',
    subtitle: (activity: string) => `Your ${activity} places. Tap a square for the detail.`,
    legend: { hi: '80+', go: '70–79 go', fair: '55–69', poor: 'under 55' },
    selKicker: (day: string, date: string, activity: string) => `${day} · ${date} · ${activity}`,
    metrics: {
      temp: 'Temp', newSnow: 'New snow', threeDay: '3-day', wind: 'Wind',
      rain: 'Rain', rain3: 'Rain, 3 days', snowing: 'Snowing', freezeThaw: 'Freeze–thaw',
    },
    rainLater: 'Later today',
    none: 'None',
    iced: ', iced',
    thawTo: (temp: string) => `To ${temp}`,
    bestOfFive: 'The best of the five days here.',
    looksBetter: (day: string, best: number, today: number) =>
      `${day} looks better — ${best} against today’s ${today}.`,
    betterBet: (day: string, best: number) => `${day} is the better bet at ${best}.`,
    withinFew: 'Within a few points of the best day here.',
    forecastLabel: 'Forecast',
    noDay: 'No forecast for this day.',
  },

  places: {
    title: 'My places',
    add: '+ Add',
    note: (activity: string) => `Your places that offer ${activity}, best right now first.`,
    rank: (n: number, name: string) => `${n}. ${name}`,
    emptyKicker: (activity: string) => `Nothing here for ${activity}`,
    emptyBody: (activity: string, distance: string) =>
      `None of your places offer ${activity} within ${distance} — pick another activity above, or add somewhere that does.`,
    unlistedNote: 'This place has dropped out of the ski-area listing. You can keep it or remove it.',
    addPlace: 'Add a place',
  },

  you: {
    title: 'Your activities and preferences',
    activitiesKicker: 'Your activities',
    activitiesNote: 'Only the activities you enable appear across the app',
    perActivity: 'Set these preferences per activity',
    prefsKicker: (activity: string) => `Your preferences for ${activity}`,
    idealTemp: 'Ideal temperature',
    idealTempHint: 'Scores fall off either side of this.',
    windLimit: 'Wind speed limit',
    windLimitHint: 'Above this the score drops away fast.',
    gettingThere: 'Getting there',
    maxDistance: 'How far you will go',
    maxDistanceHint: 'Straight-line distance from where you are. Places beyond this drop out of the ranking.',
    display: 'Display',
    units: 'Units',
    metric: '°C · cm',
    imperial: '°F · in',
    appearance: 'Appearance',
    light: 'Light',
    dark: 'Dark',
    reset: 'Reset to defaults',
    percent: (n: number) => `${n}%`,
  },

  search: {
    backLabel: 'My places',
    title: 'Add a place',
    intro: 'Add the places you visit, and pick which one is your home hill — that is the one Today opens on.',
    placeholder: 'Search by name or town',
    nearby: 'Nearest to you',
    typeToSearch: 'Type a name or a town to search all of North America.',
    meta: (parts: (string | null)[], count: number) => [...parts.filter(Boolean), `${count} of your activities`].join(' · '),
    setHome: 'Set home',
    saved: 'Saved',
    add: 'Add',
    noResults: 'Nothing by that name. Try the town, or a shorter word.',
    searching: 'Searching…',
  },

  detail: {
    dialLine: (activity: string, band: string) => `${activity} · ${band}`,
    rows: {
      temp: 'Temperature', newSnow: 'New snow, 24 h', threeDay: 'Snowfall, 3 days', freezeThaw: 'Freeze–thaw',
      wind: 'Wind', cloud: 'Cloud cover', rain: 'Rain', snowFalling: 'Snow falling', yourActivities: 'Your activities here',
    },
    yesTo: (temp: string) => `Yes, to ${temp}`,
    none: 'None',
    noneOfYours: 'None of yours',
    listSep: ', ',
  },

  loading: {
    heading: 'Updating your conditions',
    steps: {
      listing: 'Ski area listing',
      location: 'Your location',
      forecast: 'Mountain forecasts',
    },
    working: 'Scoring your places',
    ready: 'Ready',
    disclaimer: "Snowpace only scores the weather, so always check the location's web site for hours, grooming and lift status before you drive.",
  },

  help: {
    title: 'How Snowpace works',
    warning: "Snowpace only scores the weather, so always check the location's web site for hours, grooming and lift status before you drive.",
    whatKicker: 'What it is for',
    what: 'Snowpace answers one question: is it worth going out today, and where. It gathers past, current and forecast weather information for the places you have saved and calculates a score out of 100 based on the characteristics of the activities you participate in. Good conditions for skate skiing are not necessarily good conditions for downhill skiing, so every place gets a different score for each activity.',
    scoreKicker: 'What the score means',
    bands: [
      { key: 'hi', range: '80+', text: 'Go. Conditions should be ideal.' },
      { key: 'go', range: '70–79', text: 'A good day out, with one small catch.' },
      { key: 'fair', range: '55–69', text: 'Fine if you are keen, but manage your expectations.' },
      { key: 'poor', range: 'Under 55', text: 'Save your legs or look for another day or location.' },
    ] as const,
    decidesKicker: 'How it decides',
    decidesIntro: 'Eight things go into every score, weighted differently for each activity:',
    factors: [
      { k: 'New snow, 24 hours', v: 'how much has fallen since yesterday' },
      { k: 'Snowfall, 3 days', v: 'a stand-in for coverage and how fresh the surface is' },
      { k: 'Freeze–thaw', v: 'whether it went above zero and refroze, which means crust' },
      { k: 'Temperature', v: 'measured against the temperature you said you like' },
      { k: 'Wind', v: 'exposure and windchill up high' },
      { k: 'Rain', v: 'now, later today, or in the last three days — always bad, for every activity' },
      { k: 'Snow falling now', v: 'welcome on a hill or snowshoes, slow going in a set track' },
      { k: 'Cloud cover', v: 'flat light versus a bluebird day' },
    ],
    factorSep: ' — ',
    decidesOutro: 'Whichever of those is holding the day back gets highlighted in gold on the breakdown, so you can see at a glance what the catch is.',
    useKicker: 'How to use it',
    steps: [
      { t: 'Turn on your activities', d: 'On the You tab, switch on the ones you actually do. Everything else in the app filters to those.' },
      { t: 'Set what good feels like', d: 'Still on You: your ideal temperature, how much wind you will put up with, how much fresh snow you want, and how far you will go.' },
      { t: 'Add your places', d: 'My places → Add. Pick the centres and hills you go to, and set one as your home hill — that is the one Today opens on.' },
      { t: 'Check Today', d: 'The big dial is your home hill right now. Tap an hour on the chart to see how the score moves through the day, then tap the breakdown to see why.' },
      { t: 'Look ahead', d: 'Forecast lays out every saved place against the next five days. Tap any square for the detail on that day.' },
    ],
    dataKicker: 'A word on the data',
    attribution: 'Weather data by Open-Meteo.com (CC BY 4.0). Ski areas from OpenSkiData, © OpenStreetMap contributors and Skimap.org (ODbL).',
    data: "Scores come from mountain forecasts, not from someone standing on the trail. Each place shows how old its conditions report is — if it says a few hours, treat the number as a good guess rather than a promise, and check the operator's own snow report before a long drive.",
  },

  // ── Formatting phrases (lib/format.ts) ──────────────────────────────────
  format: {
    forecastMinAgo: (min: number) => `from ${min} min ago`,
    forecastHoursAgo: (h: number) => `from ${h} h ago`,
    forecastDaysAgo: (d: number) => `from ${d} day ago`,
    noForecast: 'not yet fetched',
    today: 'Today',
    weekday: (d: Date) => d.toLocaleDateString('en-CA', { weekday: 'short' }),
    monthDay: (d: Date) => d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }),
    noon: 'noon',
    am: (h: number) => `${h} AM`,
    pm: (h: number) => `${h} PM`,
    mmLater: 'Later',
    mmNone: 'None',
    mm: (v: number | string) => `${v} mm`,
    mm3d: (v: string) => `${v} mm, 3 d`,
  },

  // ── Scoring engine copy (lib/scoring.ts) ────────────────────────────────
  bands: {
    hi: 'Excellent',
    go: 'Good',
    fair: 'Fair',
    poor: 'Poor',
    skip: 'Skip it',
    none: '—',
  },

  // Short labels for the metric boxes beside a dial.
  metrics: {
    t: 'Temp', s: 'New', w: 'Wind', c: 'Cloud', pr: 'Rain', fall: 'Snowing', base: '3-day', ft: 'Thaw',
  },

  // The eight rows of the Today breakdown card.
  breakdown: {
    temp: 'Temperature',
    tempNote: (hour: string, temp: string, activity: string) =>
      `At ${hour}. You like it around ${temp} for ${activity}.`,
    newSnow: 'New snow, 24 h',
    threeDay: 'Snowfall, 3 days',
    threeDayNote: 'How much has fallen recently — a proxy for coverage and how fresh the surface is.',
    freezeThaw: 'Freeze–thaw',
    freezeThawYes: (temp: string) => `Yes, to ${temp}`,
    freezeThawNone: 'None',
    freezeThawHitNote: 'It got above freezing and refroze — expect crust in places.',
    freezeThawNoneNote: 'It has stayed below freezing throughout.',
    wind: 'Wind',
    windNote: (limit: string) => `You call it off past ${limit}.`,
    rain: 'Rain',
    snowFalling: 'Snow falling now',
    cloud: 'Cloud cover',
    cloudNote: 'Light quality, weighted lightly.',
  },

  verdict: {
    doesNotDo: (name: string, activity: string) => `${name} does not do ${activity}.`,
    noForecast: 'No forecast for this day yet.',
    manyThings: (count: string) => `${count} things are working against it today — see the breakdown.`,
    countWords: ['', '', '', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'],
    excellent: 'Everything lines up — go now, and go early.',
    great: (note: string) => `A really good one. The only note: ${note}.`,
    good: (note: string) => `A good one. ${note}, but nothing that should keep you home.`,
    fair: (note: string) => `Worth it if you are keen — ${note}.`,
    poor: (note: string) => `Soft call today: ${note}.`,
    skip: (note: string) => `Probably one to skip — ${note}.`,
  },

  // The "weakest factor" phrases that get spliced into a verdict.
  weakest: {
    colder: 'it is colder than your sweet spot',
    warmer: 'it is warmer than you like',
    notMuchFresh: 'there is not much fresh to play in',
    nothingNew: 'nothing much new has fallen',
    tooMuchUnpacked: 'there is more unpacked snow than you want to push through',
    crust: 'it thawed and refroze — expect crust',
    wind: 'the wind is the one knock',
    nothingFalling: 'nothing is falling — no fresh to play in',
    snowingOnTrack: 'it is snowing on the track while you are in it',
    flatLight: 'the light will be flat',
  },

  base: {
    dry: 'the last three days have been dry',
    only: (amount: string) => `only ${amount} has fallen in three days`,
    thin: (amount: string) => `the base is thinner than ideal at ${amount} in three days`,
  },

  rain: {
    raining: 'it is raining',
    refroze: 'it rained and then refroze — expect ice',
    recent: 'rain in the last three days has hurt the surface',
    later: 'rain is in the forecast for later today',
    movingIn: 'there is weather moving in',
    copyNow: 'It is above freezing, so this is falling as rain.',
    copyLater: 'Dry now, but rain is forecast later today.',
    copyNone: 'Nothing falling as rain.',
    copyIced: (mm: string) => `${mm} mm fell in the last three days and refroze — expect ice.`,
    copyRecent: (mm: string) => `${mm} mm of rain in the last three days has taken the edge off the surface.`,
  },

  fall: {
    downhill: (tol: number) => `Snow coming down is a bonus on the hill — your appetite is set to ${tol}%.`,
    snowshoe: (tol: number) => `Snowing while you are out is fine, even nice — set to ${tol}%.`,
    nordic: (tol: number) => `Snow filling the track while you are in it is slow going — your tolerance is ${tol}%.`,
    labelOut: 'Snow while you are out',
    labelTolerance: 'Tolerance for snowing',
  },

  snowPref: {
    labelDownhill: 'Powder appetite',
    labelSnowshoe: 'Fresh snow wanted',
    labelNordic: 'New snow tolerance',
    hintDownhill: (amount: string) => `A great day needs about ${amount} of fresh — more is always better.`,
    hintSnowshoe: (amount: string) => `About ${amount} is your ideal; more is still fine.`,
    hintNordic: (amount: string) => `Past about ${amount} of unpacked snow it stops being fun.`,
  },
};
