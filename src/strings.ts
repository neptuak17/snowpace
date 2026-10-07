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
    cancel: 'Cancel',
    backTo: (label: string) => `‹ ${label}`,
    help: 'Help',
    home: 'Home',
    chevron: '›',
    dash: '—',
    siteLink: (name: string) => `${name} web site ↗`,
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
      `${verdict} Try one of the places below or switch activity to one offered there.`,
    whereCanIGo: 'Where can I go?',
    bestLabel: (range: string) => `Best ${range}`,
    // Moves up under the answer when the home hill is Poor or worse and somewhere nearby beats it.
    betterToday: 'Better today',
    otherNearby: 'Other options nearby',
    seeAll: 'See all',
    noAlternatives: (activity: string, distance: string) =>
      `None of your other places offer ${activity} within ${distance}.`,
    noForecastKicker: 'No forecast yet',
    noForecastBody: 'The forecast for this place will be fetched when you next open the app.',
    noHomeKicker: 'No home hill set yet',
    noHomeBody: 'Add the places you go to and pick one as your home hill.',
    addPlaces: 'Add your places',
  },

  forecast: {
    title: 'Next five days',
    subtitle: (activity: string) => `Your ${activity} places. Tap a square for the detail.`,
    legend: { hi: '80+', go: '70–79 go', fair: '55–69', poor: 'under 55' },
    selKicker: (day: string, date: string, activity: string) => `${day} · ${date} · ${activity}`,
    bestOfFive: 'The best of the five days here.',
    looksBetter: (day: string, best: number, today: number) =>
      `${day} looks better — ${best} against today’s ${today}.`,
    betterBet: (day: string, best: number) => `${day} is the better bet at ${best}.`,
    withinFew: 'Close to the best day here.',
    bareWeek: 'No snow on the ground here yet.',
    noGoodDay: 'None of the next five days look good here.',
    forecastLabel: 'Forecast',
    noDay: 'No forecast for this day.',
    emptyKicker: (activity: string) => `Nothing here for ${activity}`,
    emptyBody: (activity: string) => `None of your places offer ${activity}. Pick another activity, or add a place that does.`,
    addPlace: 'Add a place',
  },

  places: {
    title: 'My places',
    add: '+ Add',
    note: (activity: string) => `Best for ${activity} now.`,
    rank: (n: number, name: string) => `${n}. ${name}`,
    notAvailable: (activity: string) => `${activity.charAt(0).toUpperCase() + activity.slice(1)} not available at these locations`,
    emptyKicker: 'No places yet',
    emptyBody: 'Add the centres and hills you go to. Everything you save shows up here, however far away it is.',
    unlistedNote: 'This place has dropped out of the OpenSkiData ski-area listing. You can keep it or remove it.',
    addPlace: 'Add a place',
  },

  you: {
    title: 'Your activities and preferences',
    activitiesKicker: 'Your activities',
    activitiesNote: 'Only the activities you enable appear across the app',
    perActivity: 'Set your preferences per activity',
    prefsKicker: (activity: string) => `Your preferences for ${activity}`,
    idealTemp: 'Ideal temperature',
    idealTempHint: 'Scores fall off either side of this.',
    windLimit: 'Wind speed limit',
    windLimitHint: 'Above this the score drops away fast.',
    gettingThere: 'Getting there',
    maxDistance: 'How far you will travel',
    maxDistanceHint: 'Straight-line distance from where you are. Places beyond this drop out of the ranking.',
    webcamsKicker: 'Webcams',
    webcamsLabel: 'Show webcams',
    webcamsHint: 'A recent picture from windy.com for the place you are looking at. While this is on, the location of that place is sent to windy.com to find its cameras.',
    display: 'Display',
    units: 'Units',
    metric: '°C · cm',
    imperial: '°F · in',
    appearance: 'Appearance',
    light: 'Light',
    dark: 'Dark',
    reset: 'Reset all activity preferences',
    resetTitle: 'Reset all activity preferences?',
    resetBody: 'This puts the temperature, wind, snow and precipitation settings back to their defaults for every activity, not just this one, and resets how far you will go. Your places are not affected.',
    resetConfirm: 'Reset',
    percent: (n: number) => `${n}%`,
  },

  search: {
    backLabel: 'My places',
    title: 'Add a place',
    intro: 'Add the places you visit, and pick which one is your home hill. That is the one Today opens on.',
    placeholder: 'Search by name or town',
    yours: 'Your places',
    nearby: 'Nearest to you',
    typeToSearch: 'Type a name or a town to search all of North America.',
    meta: (parts: (string | null)[], count: number) => [...parts.filter(Boolean), `${count} of your activities`].join(' · '),
    setHome: 'Set home',
    saved: 'Saved',
    add: 'Add',
    noResults: 'Nothing by that name. Try the town, or a shorter word.',
    searching: 'Searching…',
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
    disclaimer: "Snowpace only scores the weather. Before you go, check the location's web site for hours, grooming and lift status, and the avalanche forecast for the area.",
  },

  help: {
    title: 'How Snowpace works',
    warning: "Snowpace only scores the weather. Before you go, check the location's web site for hours, grooming and lift status, and the avalanche forecast for the area.",
    whatKicker: 'What it is for',
    what: 'Snowpace answers one question: is it worth going out today, and where should I go? It gathers past, current and forecast weather information for the places you have saved and calculates a score out of 100 based on the characteristics of the activities you participate in. Good conditions for skate skiing are not necessarily good conditions for downhill skiing, so every place gets a different score for each activity.',
    scoreKicker: 'What the score means',
    bands: [
      { key: 'hi', range: '80+', text: 'Conditions should be ideal.' },
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
      { k: 'Temperature', v: 'measured against the temperature you said you prefer' },
      { k: 'Wind', v: 'exposure and windchill up high' },
      { k: 'Rain', v: 'recent or forecast rain is always bad, for every activity' },
      { k: 'Snow falling', v: 'welcome for downhill or snowshoeing, slow going on skinny skis' },
      { k: 'Cloud cover', v: 'flat light versus a bluebird day' },
    ],
    factorSep: ' — ',
    decidesSnowpack: 'On top of those, the modelled snowpack caps the score: on bare ground it is 0, however good the weather. For skate skiing, deep new snow caps it too, because the lane stays soft and slow until it has been packed.',
    decidesOutro: 'The sentence under the dial names whatever is holding the day back, and Why? shows how each one scored.',
    useKicker: 'How to use it',
    steps: [
      { t: 'Turn on your activities', d: 'On the You tab, enable the ones you do. Everything else in the app filters to those.' },
      { t: 'Set what good feels like', d: 'Your ideal temperature, how much wind you will put up with, how much fresh snow you want, and how far you will travel.' },
      { t: 'Add your places', d: 'My places → Add. Pick the centres and hills you go to, and set one as your home hill. That is the one Today opens on.' },
      { t: 'Check Today', d: 'The big dial is how today looks at your home hill, with its best hours and the reason in a sentence. Tap an hour on the strip for that hour, and tap Why? to see what is behind the score. On a poor day, better places nearby are listed right under it.' },
      { t: 'See it for yourself', d: 'Under the hours, a recent webcam picture from windy.com shows the place itself. Tap it to see it larger on windy.com, tap Refresh for a newer one, or tap Other cameras to choose a different view. A place with no camera of its own shows none, and you can switch webcams off on the You tab.' },
      { t: 'Look ahead', d: 'Forecast lays out every saved place against the next five days. Tap any square for the detail on that day.' },
    ],
    dataKicker: 'A word on the data',
    creditsLink: 'Credits and data sources',
    data: "Scores come from mountain weather forecasts, so treat them as a forecast, not a report. Each place shows how old its forecast is, and each webcam how recent its picture is. Webcam pictures come from windy.com; they are there to look at and never change a score. Remember to check the operator's snow report before a long drive.",
    feedbackKicker: 'Something to tell me?',
    feedbackBody: 'A score that looked wrong, something broken, or an idea for the app. Feedback goes straight to the developer.',
    feedbackButton: 'Send feedback',
  },

  credits: {
    title: 'Credits',
    intro: 'Snowpace gathers data from various reliable public sources.',
    sourcesKicker: 'Where the data comes from',
    sources: [
      {
        name: 'Open-Meteo',
        what: 'The mountain forecasts behind every score (temperature, snow, wind, cloud and modelled snow depth, hour by hour).',
        licence: 'Weather data by Open-Meteo.com, CC BY 4.0',
        links: [{ label: 'Open-Meteo', url: 'https://open-meteo.com' }],
      },
      {
        name: 'OpenSkiData',
        what: 'The list of ski areas (names, locations, elevations and what each one offers). Built from OpenStreetMap contributors and, for the areas they have not mapped, Skimap.org.',
        licence: '© OpenStreetMap contributors and Skimap.org, Open Database License (ODbL) 1.0',
        links: [
          { label: 'OpenSkiData', url: 'https://openskimap.org' },
          { label: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
          { label: 'Skimap.org', url: 'https://skimap.org' },
        ],
      },
      {
        name: 'Windy.com',
        what: 'The webcam pictures on Today and the place screen, while webcams are switched on. They are there to look at and never change a score.',
        licence: 'Webcams provided by windy.com. Each picture links to its camera page on windy.com.',
        links: [
          { label: 'Windy.com', url: 'https://www.windy.com/' },
          { label: 'Add new webcam', url: 'https://www.windy.com/webcams/add' },
        ],
      },
    ] as const,
    appKicker: 'The app',
    projectLink: 'Snowpace on GitHub',
    privacyLink: 'Privacy policy on GitHub',
    version: (v: string) => `Version ${v}`,
    openLink: (name: string) => `${name} ↗`,
  },

  feedback: {
    title: 'Send feedback',
    kindKicker: 'What is it about?',
    kinds: { bug: "Something's wrong", score: 'A score looks off', idea: 'An idea', other: 'Something else' },
    placeKicker: 'Which place?',
    placeHint: 'So the forecast behind the score can come along.',
    noPlaces: 'No saved places yet — describe the place in the email instead.',
    diagnosticsLabel: 'Include diagnostics',
    diagnosticsHint: 'App and iOS versions, your activities and settings (including whether webcams are on), when data was last fetched, and — if you picked a place — its forecast and score. Never your location or your other places.',
    howItSends: 'Tapping Send opens Mail with a draft addressed to me. Write what happened, then send it from your own account.',
    send: 'Send',
    unavailableKicker: 'Mail is not set up on this phone',
    unavailable: (email: string) => `Email me directly at ${email} instead.`,
    thanks: 'Thanks — it is on its way.',
    saved: 'Saved as a draft in Mail.',
    // The email itself.
    subject: (kind: string, place: string | null) => `Snowpace feedback: ${kind}${place ? ` — ${place}` : ''}`,
    bodyPrompt: (kind: 'bug' | 'score' | 'idea' | 'other') =>
      kind === 'idea' || kind === 'other' ? '(What is on your mind?)' : '(What happened? What did you expect, and what did you see?)',
    divider: '—————— Diagnostics (delete this block if you would rather not send it) ——————',
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

  // Coverage, from the modelled snow depth. The depth itself is never shown.
  coverage: { bare: 'Bare', thin: 'Thin', enough: 'Enough' },

  // Surface firmness, from the weather (shadow mode: shown, not yet scored).
  surface: {
    words: { fresh: 'Fresh', soft: 'Soft', packed: 'Packed', firm: 'Firm', icy: 'Icy', slushy: 'Slushy' },
    // Morning and afternoon, when the day changes.
    change: (am: string, pm: string) => `${am} → ${pm}`,
  },

  // The answer card: the day's score, its best hours, and the day in three numbers.
  answer: {
    facts: (parts: string[]) => parts.join(' · '),
    wind: (w: string) => `wind ${w}`,
    newSnow: (s: string) => `${s} new`,
  },

  // The webcam row on Today and the place screen, and the Other cameras list.
  webcam: {
    title: 'Webcam',
    updated: (age: string) => `Updated ${age}`,
    lastDaylight: 'Last daylight image',
    justNow: 'just now',
    minAgo: (min: number) => `${min} min ago`,
    hoursAgo: (h: number) => `${h} h ago`,
    refresh: 'Refresh',
    others: 'Other cameras ›',
    openLabel: (title: string) => `${title}. Opens the camera on windy.com.`,
    // Windy's required courtesy line, in the wording its terms give.
    creditLead: 'Webcams provided by ',
    creditSite: 'windy.com',
    creditSiteUrl: 'https://www.windy.com/',
    creditSep: ' — ',
    creditAdd: 'add new webcam',
    creditAddUrl: 'https://www.windy.com/webcams/add',
    listTitle: 'Other cameras',
    listIntro: (name: string) => `Choose the camera Snowpace shows for ${name}. Tap a picture to see it on windy.com.`,
    bestMatch: 'Best match',
    bestMatchNote: 'Snowpace picks the camera whose name best fits the place.',
    away: (distance: string) => `${distance} away`,
    showing: 'Showing',
    loading: (name: string) => `Looking for cameras near ${name}…`,
    none: (distance: string) => `No webcams on windy.com within ${distance}.`,
    failed: 'Could not reach windy.com. Try again later.',
  },

  // The detail behind a day's score, opened from the answer.
  why: {
    show: 'Why? ›',
    hide: 'Hide the detail ›',
    kicker: 'Behind the score',
    hours: 'Hour by hour',
  },

  // Today's hours, under the answer, and the condition rows in the detail.
  hourGrid: {
    title: 'Today, hour by hour',
    rows: { all: 'Overall', t: 'Temp', w: 'Wind', precip: 'Snow/rain', light: 'Light', sky: 'Sky' },
    // Spoken by VoiceOver for one hour of the Overall row.
    cellLabel: (hour: string, band: string, score: number | null) =>
      score === null ? `${hour}, no forecast` : `${hour}, ${band}, ${score}`,
    // Spoken for a whole condition row: "Wind: Excellent 7 AM to 1 PM, Poor 2 PM to 5 PM".
    rowLabel: (row: string, runs: string[]) => `${row}: ${runs.join(', ')}`,
    rowRun: (band: string, from: string, to: string) => (from === to ? `${band} at ${from}` : `${band} ${from} to ${to}`),
    noForecast: 'no forecast',
    // The line under the strip for the tapped hour: "3 PM · Fair 62 · 2°C · wind 30 km/h".
    line: (parts: (string | null)[]) => parts.filter(Boolean).join(' · '),
    scored: (band: string, score: number) => `${band} ${score}`,
    wind: (w: string) => `wind ${w}`,
    rain: (mm: string) => `rain ${mm} mm`,
    snow: (mm: string) => `snow ${mm} mm`,
  },

  // The rows of the Today breakdown card.
  breakdown: {
    temp: 'Temperature',
    tempNote: (temp: string, activity: string) =>
      `Daytime average. You like it around ${temp} for ${activity}.`,
    newSnow: 'New snow, 24 h',
    deepSnowNote: 'This much new snow also caps the skate score: the lane stays soft and slow until it has been packed.',
    threeDay: 'Snowfall, 3 days',
    threeDayNote: 'How much has fallen recently (how fresh the surface is).',
    freezeThaw: 'Freeze–thaw',
    freezeThawYes: (temp: string) => `Yes, to ${temp}`,
    freezeThawNone: 'None',
    freezeThawHitNote: 'It got above freezing and refroze (expect crust in places).',
    freezeThawNoneNote: 'It has stayed below freezing throughout.',
    freezeThawThawedNote: 'It has been above freezing throughout (no crust expected, but nothing has firmed up either).',
    wind: 'Wind',
    windNote: (limit: string) => `You call it off past ${limit}.`,
    rain: 'Rain',
    snowFalling: 'Snow falling',
    cloud: 'Cloud cover',
    cloudNote: 'Light quality, weighted lightly.',
    snowpack: 'Snowpack',
    snowpackNote: 'Modelled depth, not a measurement (it does not account for snowmaking).',
    surface: 'Surface',
    surfaceNote: 'An estimate of what the weather is doing to the snow, assuming normal overnight grooming. Shown for information; not yet part of the score.',
  },

  verdict: {
    doesNotDo: (name: string, activity: string) => `${name} does not do ${activity}.`,
    noForecast: 'No forecast for this day yet.',
    bareGround: 'No snow on the ground to speak of.',
    manyThings: (count: string) => `${count} things are working against it today.`,
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
    notMuchFresh: 'there is not much fresh snow to play in',
    nothingNew: 'not much new snow has fallen',
    tooMuchUnpacked: 'there is more unpacked snow than you might want to push through',
    crust: 'it thawed and refroze (expect crust)',
    wind: 'the wind is the one knock',
    notMuchFalling: 'not much snow is falling',
    tooMuchFalling: 'more snow is falling than you like',
    snowingOnTrack: 'it is snowing on the track',
    flatLight: 'the light will be flat',
    bareGround: 'there is no snow on the ground',
    thinSnowpack: 'the snowpack is thin',
  },

  base: {
    dry: 'the last three days have been dry',
    only: (amount: string) => `only ${amount} has fallen in three days`,
    thin: (amount: string) => `the base is thinner than ideal at ${amount} in three days`,
  },

  rain: {
    raining: 'rain is forecast',
    refroze: 'it rained and then refroze (expect ice)',
    recent: 'rain in the last three days has hurt the surface',
    later: 'rain is in the forecast for later today',
    movingIn: 'there is weather moving in',
    copyNow: 'Rain is forecast: it is warm enough to fall as rain rather than snow.',
    copyLater: 'Dry now, but rain is forecast later today.',
    copyNone: 'No rain forecast.',
    copyIced: (mm: string) => `${mm} mm fell in the last three days and refroze (expect ice).`,
    copyRecent: (mm: string) => `${mm} mm of rain in the last three days has degraded the surface.`,
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
