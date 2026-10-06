/**
 * Where Snowpace lives and how to reach its author. The User-Agent every
 * outbound request carries names the project page, so the operators of the
 * services we call can find out what Snowpace is and get in touch — their
 * first move is then an email rather than a block.
 */
export const PROJECT_URL = 'https://github.com/neptuak17/snowpace';

export const FEEDBACK_EMAIL = 'clifford.smith@gmail.com';

/** The privacy policy, as the App Store listing and the credits screen link to it. */
export const PRIVACY_URL = `${PROJECT_URL}/blob/main/PRIVACY.md`;

export const USER_AGENT = `Snowpace/1.0 (+${PROJECT_URL})`;

/**
 * The Windy Webcams API key. It is never committed: in development it comes
 * from `.env.local` (git-ignored), and for EAS builds from an EAS environment
 * variable. Expo copies EXPO_PUBLIC_ variables into the app at build time, so
 * the key ships inside the app, as any key a phone uses directly must; it is
 * kept out of the public repository because Windy's terms forbid publishing
 * it. With no key, the webcam feature is simply absent.
 */
export const WINDY_API_KEY: string | null = process.env.EXPO_PUBLIC_WINDY_API_KEY || null;
