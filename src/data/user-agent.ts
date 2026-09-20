/**
 * The User-Agent every outbound request carries. The "+URL" names a page
 * where the operators of the services we call can find out what Snowpace is
 * and how to reach us, so their first move is an email rather than a block.
 */
export const PROJECT_URL = 'https://github.com/neptuak17/snowpace';

export const USER_AGENT = `Snowpace/1.0 (+${PROJECT_URL})`;
