/**
 * The free stage: does this text read like a request at all? US-413.
 *
 * A generic search matches loosely — "which should I buy" returned a breakup
 * and a bond market report — so most of what arrives asks for nothing. On the
 * US-413 fixtures this rule kept 30 of 159 X posts and 9 of their 11 requests,
 * and 6 of 49 Reddit posts and 3 of 4. The model then reads a fifth of the
 * posts, which is the point: the model is paid per post, this is not.
 *
 * It drops some real requests ("looking for a value for money tool chest"
 * has no question mark). That is the price of the saving, and it was
 * measured, not guessed.
 */
const requestPhrase =
  /(recommend|suggestion|alternative to|what (app|tool|software|device|do you (guys |all )?use)|which (one|\w+) (should|do) i (buy|get)|looking for (a|an|some)?\s?\w*\s?(app|tool|recommendation)|any (good )?(app|tool)s? for|anyone know (a|of|any)|worth (it|buying))/i;

export function readsLikeRequest(text: string): boolean {
  return text.includes("?") && requestPhrase.test(text);
}
