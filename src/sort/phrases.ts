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
  /(recommend|suggestion|alternatives? (to|for)|what (app|tool|software|device|platform|service|do you (guys |all )?use)|which (one|\w+) (should|do) i (buy|get|use)|looking for (a|an|some)?\s?\w*\s?(app|tool|software|recommendation)|any (good )?(app|tool|software)s? (for|that)|is there (an? )?(app|tool|software|plugin|extension|service)|anyone know (a|of|any)|worth (it|buying))/i;

/**
 * Someone who wants to hire (US-429). A gig or a request for a provider often
 * has no question mark — "[Hiring] Logo for a bakery, $150" — so these pass
 * on the phrase alone.
 */
const hirePhrase =
  /(\[hiring\]|\[task\]|looking to hire|want to hire|need to hire|hire (an?|some) ?\w* ?(developer|designer|agency|freelancer|marketer|writer|editor|accountant|bookkeeper|consultant|assistant|va|expert|someone)|(looking for|need|recommend) (an?|some|any) ?\w* ?(developer|designer|agency|freelancer|marketer|copywriter|writer|video editor|accountant|bookkeeper|consultant|virtual assistant|seo|expert)|need someone to (build|make|design|create|fix|help|run|manage|write))/i;

/**
 * A post that offers work rather than asks for it. In the hiring subreddits
 * about three posts in four are offers — "[For Hire] Web designer", "[Offer]
 * Logo design" — and the model refuses every one; this refuses them for free
 * (US-429).
 */
const offerTag = /^\s*[[(]\s*(for hire|offer|hire me|forhire)\s*[\])]/i;

export function offersWork(title: string | undefined, text: string): boolean {
  return offerTag.test(title ?? "") || offerTag.test(text);
}

export function readsLikeRequest(text: string): boolean {
  return (text.includes("?") && requestPhrase.test(text)) || hirePhrase.test(text);
}
