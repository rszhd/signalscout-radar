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
 * Asking about a thing to buy, in the words a forum uses for gear (US-511).
 * Radar's forums are niche hobby and trade boards, so the product is a
 * physical one more often than an app: "best smoker under $500", "Fender vs
 * Mk7", "which grinder should I get", "has anyone used this generator". With
 * a question mark, like `requestPhrase`.
 */
const buyingPhrase =
  /(\bbest\b(\s[\w'-]+){0,4}\s(for|under|to|in|on)\b|\b(vs\.?|versus)\s|which (one|brand|model|size|type|kind)|what (brand|model|size|type|kind)\b|(should|would) (i|you) (buy|get|go with|choose|pick|order)|(thinking|considering|planning) (of |about )?(buying|getting|ordering|picking up|upgrading)|(has |does )?any(one|body| of you) (used|using|tried|use|own|owned|have experience|running)|experience with (the |this |a |an )?\w|where (can i|to|do you|did you|should i) (buy|find|get|source|order)|(source|supplier|vendor) for\b|any (other |good |better )?(options|brands)|what (are |is )?(every(one|body)|you guys|you all|y'all|people|others|other people|folks) (are )?(using|running|buying)|(you'?d|would you|you would) (buy|get|choose|pick)|(want|wanting|need|needing) (a|an|some|to buy|to get|to purchase|to order)\b|interested in (buying|getting|one)|what (do|would) (you|people) (use|run|buy|get)|(everyone'?s|your) fav(ou)?rite|upgrade (from|to|path))/i;

/**
 * A title that asks for a product needs no question mark: forum titles state
 * the request — "Meat slicer recommendations", "[WTB] Espro pitcher",
 * "O-ring source needed", "Recommend Me a RUT". Of 219 forum threads read on
 * 2026-11-03, 7 passed the body rule alone, 2 of them requests; most
 * requests among the 212 it dropped had no question mark.
 */
const titlePhrase =
  /(recommend|suggestions?\b|\badvice\b|\[?\bwtb\b\]?|want(ed)? to buy|looking to buy|in the market for|\bbest\b(?!\s(way|method|practice|time|place|of luck|wishes))|\b(vs\.?|versus)\s|which (one|\w+) (to|should)|should i (buy|get)|worth (it|buying|the money)|help (me )?(choose|pick|decide|find)|alternatives?\b|replacement for|source (needed|for)|where to (buy|find|get)|upgrade (from|to|path)|options\?|\bfirst\s[\w-]+\s?\?|^(looking for|needed|wanted|seeking|searching for|in search of|iso)\b|^need\b(?!\s(to|help|some|your|prayers|info))|\bneeded\W*$|\bor\b[^?]*\?\W*$|\bany(one|body)\b.*\b(using|use|used|tried|own|owned|have|spring for|bought)\b|\bany(one|body)\s*\?\W*$)/i;

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
/** A forum's sale post names the product too, but sells it. */
const forSale = /^\s*\[?\s*(fs|for sale|fs\/ft|ft|sold|wts)\b/i;

const offerTag = /^\s*[[(]\s*(for hire|offer|hire me|forhire)\s*[\])]/i;

export function offersWork(title: string | undefined, text: string): boolean {
  return offerTag.test(title ?? "") || offerTag.test(text);
}

/**
 * `text` is the post with its title, as before; `title` alone may also be
 * given, and a request in it passes without a question mark (US-511).
 */
export function readsLikeRequest(text: string, title?: string): boolean {
  if (title && titlePhrase.test(title) && !forSale.test(title)) return true;
  return (text.includes("?") && (requestPhrase.test(text) || buyingPhrase.test(text))) || hirePhrase.test(text);
}
