/**
 * The forums Radar reads, each through its newest-threads feed (US-511).
 * Copied from BuyerFinder (signalscout-lookout `src/worker/known-forums.ts`,
 * 1856d53): each one's feed listed threads in the feed survey of 2026-11-01.
 * Hosts have no leading "www.". Without the niches whose threads ask for
 * software, services or money rather than physical goods (owner, 2026-11-03:
 * "focus on physical goods"): web hosting, SEO, programming, ecommerce
 * sellers, small business owners, personal finance, real estate, travel.
 */
export interface KnownForum {
  readonly host: string;
  readonly name: string;
  readonly niche: string;
  /** The parser that read the feed; null for a feed no parser names. */
  readonly program: string | null;
  readonly feed: string;
}

export const knownForums: readonly KnownForum[] = [
  { host: "3dprinting.stackexchange.com", name: "3D Printing Stack Exchange", niche: "3D printing", program: null, feed: "https://3dprinting.stackexchange.com/feeds" },
  { host: "3dprintingspace.com", name: "3D Printing Space", niche: "3D printing", program: "discourse", feed: "https://3dprintingspace.com/latest.json?order=created" },
  { host: "forum.makerforums.info", name: "Maker Forums", niche: "3D printing", program: "discourse", feed: "https://forum.makerforums.info/latest.json?order=created" },
  { host: "forum.vorondesign.com", name: "VORON Design Community Forum", niche: "3D printing", program: "xenforo2", feed: "https://forum.vorondesign.com/forums/-/index.rss" },
  { host: "reprap.org", name: "RepRap Forum", niche: "3D printing", program: null, feed: "https://reprap.org/forum/feed.php?0,type=rss" },
  { host: "fishforums.net", name: "Fish Forums", niche: "aquariums and fishkeeping", program: "xenforo2", feed: "https://www.fishforums.net/forums/-/index.rss" },
  { host: "fishlore.com", name: "FishLore Aquarium Forum", niche: "aquariums and fishkeeping", program: "xenforo2", feed: "https://www.fishlore.com/aquariumfishforum/forums/-/index.rss" },
  { host: "monsterfishkeepers.com", name: "MonsterFishKeepers", niche: "aquariums and fishkeeping", program: "xenforo2", feed: "https://www.monsterfishkeepers.com/forums/forums/-/index.rss" },
  { host: "plantedtank.net", name: "The Planted Tank Forum", niche: "aquariums and fishkeeping", program: "xenforo2", feed: "https://www.plantedtank.net/forums/-/index.rss" },
  { host: "reef2reef.com", name: "Reef2Reef", niche: "aquariums and fishkeeping", program: "xenforo2", feed: "https://www.reef2reef.com/forums/-/index.rss" },
  { host: "ukaps.org", name: "UK Aquatic Plant Society", niche: "aquariums and fishkeeping", program: "xenforo2", feed: "https://www.ukaps.org/forum/forums/-/index.rss" },
  { host: "airlinepilotforums.com", name: "Airline Pilot Central Forums", niche: "aviation and pilots", program: "vbulletin4", feed: "https://www.airlinepilotforums.com/external.php?type=RSS2" },
  { host: "airliners.net", name: "Airliners.net Forums", niche: "aviation and pilots", program: "phpbb3", feed: "https://www.airliners.net/forum/feed.php?mode=topics" },
  { host: "pilotsofamerica.com", name: "Pilots of America", niche: "aviation and pilots", program: "xenforo2", feed: "https://www.pilotsofamerica.com/community/forums/-/index.rss" },
  { host: "pprune.org", name: "Professional Pilots Rumour Network (PPRuNe)", niche: "aviation and pilots", program: "vbulletin4", feed: "https://www.pprune.org/external.php?type=RSS2" },
  { host: "bbq-brethren.com", name: "The BBQ Brethren", niche: "barbecue and smoking", program: "xenforo2", feed: "https://www.bbq-brethren.com/forums/-/index.rss" },
  { host: "smokingmeatforums.com", name: "Smoking Meat Forums", niche: "barbecue and smoking", program: "xenforo2", feed: "https://www.smokingmeatforums.com/forums/-/index.rss" },
  { host: "tvwbb.com", name: "The Virtual Weber Bulletin Board", niche: "barbecue and smoking", program: "xenforo2", feed: "https://tvwbb.com/forums/-/index.rss" },
  { host: "backyardchickens.com", name: "BackYard Chickens", niche: "beekeeping and homesteading", program: "xenforo2", feed: "https://www.backyardchickens.com/forums/-/index.rss" },
  { host: "beekeepingforum.co.uk", name: "Beekeeping Forum", niche: "beekeeping and homesteading", program: "xenforo2", feed: "https://beekeepingforum.co.uk/forums/-/index.rss" },
  { host: "beemaster.com", name: "Beemaster's International Beekeeping Forum", niche: "beekeeping and homesteading", program: "smf2", feed: "https://beemaster.com/forum/index.php?action=.xml;type=rss2;sa=news" },
  { host: "beesource.com", name: "Beesource Beekeeping Forums", niche: "beekeeping and homesteading", program: "xenforo2", feed: "https://www.beesource.com/forums/-/index.rss" },
  { host: "homesteadingtoday.com", name: "Homesteading Today", niche: "beekeeping and homesteading", program: "xenforo2", feed: "https://www.homesteadingtoday.com/forums/-/index.rss" },
  { host: "bgdf.com", name: "Board Game Designers Forum", niche: "board games", program: null, feed: "https://www.bgdf.com/rss.xml" },
  { host: "consimworld.com", name: "ConsimWorld", niche: "board games", program: null, feed: "https://consimworld.com/feed/" },
  { host: "forum.rpg.net", name: "RPGnet Forums", niche: "board games", program: "xenforo2", feed: "https://forum.rpg.net/index.php?forums/-/index.rss" },
  { host: "cruisersforum.com", name: "Cruisers Forum", niche: "boating", program: "vbulletin4", feed: "https://www.cruisersforum.com/forums/external.php?type=RSS2" },
  { host: "forums.iboats.com", name: "iboats Boating Forums", niche: "boating", program: "xenforo2", feed: "https://forums.iboats.com/forums/-/index.rss" },
  { host: "forums.sailinganarchy.com", name: "Sailing Anarchy Forums", niche: "boating", program: "xenforo2", feed: "https://forums.sailinganarchy.com/forums/-/index.rss" },
  { host: "sailnet.com", name: "SailNet Community", niche: "boating", program: "xenforo2", feed: "https://www.sailnet.com/forums/-/index.rss" },
  { host: "thehulltruth.com", name: "The Hull Truth", niche: "boating", program: "vbulletin4", feed: "https://www.thehulltruth.com/external.php?type=RSS2" },
  { host: "bimmerforums.com", name: "Bimmerforums", niche: "cars and car enthusiasts", program: "vbulletin4", feed: "https://www.bimmerforums.com/forum/external.php?type=RSS2" },
  { host: "bobistheoilguy.com", name: "Bob Is The Oil Guy", niche: "cars and car enthusiasts", program: "xenforo2", feed: "https://bobistheoilguy.com/forums/forums/-/index.rss" },
  { host: "corvetteforum.com", name: "CorvetteForum", niche: "cars and car enthusiasts", program: "vbulletin4", feed: "https://www.corvetteforum.com/forums/external.php?type=RSS2" },
  { host: "vwvortex.com", name: "VWVortex", niche: "cars and car enthusiasts", program: "xenforo2", feed: "https://www.vwvortex.com/forums/-/index.rss" },
  { host: "coffeeforums.co.uk", name: "Coffee Forums UK", niche: "coffee", program: "xenforo2", feed: "https://www.coffeeforums.co.uk/forums/-/index.rss" },
  { host: "coffeeforums.com", name: "CoffeeForums.com", niche: "coffee", program: "xenforo2", feed: "https://www.coffeeforums.com/forums/-/index.rss" },
  { host: "coffeesnobs.com.au", name: "CoffeeSnobs", niche: "coffee", program: "vbulletin5", feed: "https://coffeesnobs.com.au/external?type=rss2" },
  { host: "home-barista.com", name: "Home-Barista", niche: "coffee", program: "phpbb3", feed: "https://www.home-barista.com/forums/feed.php?mode=topics" },
  { host: "bikeforums.net", name: "Bike Forums", niche: "cycling", program: "vbulletin4", feed: "https://www.bikeforums.net/external.php?type=RSS2" },
  { host: "cyclechat.net", name: "CycleChat", niche: "cycling", program: "xenforo2", feed: "https://www.cyclechat.net/forums/-/index.rss" },
  { host: "forum.cyclinguk.org", name: "Cycling UK Forum", niche: "cycling", program: "phpbb3", feed: "https://forum.cyclinguk.org/app.php/feed/topics" },
  { host: "mtbr.com", name: "MTBR", niche: "cycling", program: "xenforo2", feed: "https://www.mtbr.com/forums/-/index.rss" },
  { host: "roadbikereview.com", name: "Road Bike Review", niche: "cycling", program: "xenforo2", feed: "https://www.roadbikereview.com/forums/-/index.rss" },
  { host: "dogforum.com", name: "Dog Forum", niche: "dogs", program: "xenforo2", feed: "https://www.dogforum.com/forums/-/index.rss" },
  { host: "dogforums.com", name: "Dog Forums", niche: "dogs", program: "xenforo2", feed: "https://www.dogforums.com/forums/-/index.rss" },
  { host: "germanshepherds.com", name: "German Shepherds Forum", niche: "dogs", program: "xenforo2", feed: "https://www.germanshepherds.com/forums/-/index.rss" },
  { host: "goldenretrieverforum.com", name: "Golden Retriever Forum", niche: "dogs", program: "xenforo2", feed: "https://www.goldenretrieverforum.com/forums/-/index.rss" },
  { host: "labradorforums.co.uk", name: "Labrador Forums", niche: "dogs", program: "xenforo2", feed: "https://www.labradorforums.co.uk/forums/-/index.rss" },
  { host: "petforums.co.uk", name: "Pet Forums \u2014 Dog Forums", niche: "dogs", program: "xenforo2", feed: "https://www.petforums.co.uk/forums/-/index.rss" },
  { host: "fpvdronepilots.com", name: "FPV Drone Pilots", niche: "drones", program: "xenforo2", feed: "https://fpvdronepilots.com/forums/-/index.rss" },
  { host: "intofpv.com", name: "IntoFPV", niche: "drones", program: "mybb", feed: "https://intofpv.com/syndication.php" },
  { host: "mavicpilots.com", name: "Mavic Pilots", niche: "drones", program: "xenforo2", feed: "https://mavicpilots.com/forums/-/index.rss" },
  { host: "phantompilots.com", name: "Phantom Pilots", niche: "drones", program: "xenforo2", feed: "https://phantompilots.com/forums/-/index.rss" },
  { host: "rcgroups.com", name: "RC Groups", niche: "drones", program: "vbulletin4", feed: "https://www.rcgroups.com/external.php?type=RSS2" },
  { host: "yuneecpilots.com", name: "Yuneec Pilots", niche: "drones", program: "xenforo2", feed: "https://yuneecpilots.com/forums/-/index.rss" },
  { host: "bassresource.com", name: "BassResource Fishing Forums", niche: "fishing", program: "invision4", feed: "https://www.bassresource.com/bass-fishing-forums/rss/1-bassresource-forum.xml/" },
  { host: "anabolicminds.com", name: "AnabolicMinds", niche: "fitness and bodybuilding", program: "xenforo2", feed: "https://anabolicminds.com/community/forums/-/index.rss" },
  { host: "elitefitness.com", name: "EliteFitness", niche: "fitness and bodybuilding", program: "xenforo2", feed: "https://www.elitefitness.com/forum/forums/-/index.rss" },
  { host: "evolutionary.org", name: "Evolutionary", niche: "fitness and bodybuilding", program: "xenforo2", feed: "https://www.evolutionary.org/forums/forums/-/index.rss" },
  { host: "professionalmuscle.com", name: "Professional Muscle", niche: "fitness and bodybuilding", program: "xenforo2", feed: "https://www.professionalmuscle.com/forums/index.php?forums/-/index.rss" },
  { host: "badgerandblade.com", name: "Badger & Blade \u2014 fragrance discussions within a broader grooming forum", niche: "fragrance", program: "xenforo2", feed: "https://www.badgerandblade.com/forum/forums/-/index.rss" },
  { host: "basenotes.com", name: "Basenotes", niche: "fragrance", program: "xenforo2", feed: "https://basenotes.com/community/forums/-/index.rss" },
  { host: "fragrantica.com", name: "Fragrantica", niche: "fragrance", program: null, feed: "https://www.fragrantica.com/board/extern.php?action=feed&type=rss" },
  { host: "gardenerscorner.co.uk", name: "Gardeners Corner", niche: "gardening", program: "xenforo2", feed: "https://www.gardenerscorner.co.uk/forums/-/index.rss" },
  { host: "gardening-forums.com", name: "Gardening Forums", niche: "gardening", program: "xenforo2", feed: "https://www.gardening-forums.com/forums/-/index.rss" },
  { host: "forums.golfmonthly.com", name: "Golf Monthly Forum", niche: "golf", program: "xenforo2", feed: "https://forums.golfmonthly.com/forums/-/index.rss" },
  { host: "thehackersparadise.com", name: "The Hackers Paradise", niche: "golf", program: "xenforo2", feed: "https://www.thehackersparadise.com/forum/forums/-/index.rss" },
  { host: "acousticguitarforum.com", name: "The Acoustic Guitar Forum", niche: "guitars", program: "vbulletin4", feed: "https://www.acousticguitarforum.com/forums/external.php?type=RSS2" },
  { host: "mylespaul.com", name: "My Les Paul", niche: "guitars", program: "xenforo2", feed: "https://www.mylespaul.com/forums/-/index.rss" },
  { host: "sevenstring.org", name: "SevenString.org", niche: "guitars", program: "xenforo2", feed: "https://www.sevenstring.org/forums/-/index.rss" },
  { host: "strat-talk.com", name: "Strat-Talk", niche: "guitars", program: "xenforo2", feed: "https://www.strat-talk.com/forums/-/index.rss" },
  { host: "tdpri.com", name: "TDPRI", niche: "guitars", program: "xenforo2", feed: "https://www.tdpri.com/forums/-/index.rss" },
  { host: "thegearpage.net", name: "The Gear Page", niche: "guitars", program: "xenforo2", feed: "https://www.thegearpage.net/board/index.php?forums/-/index.rss" },
  { host: "forums.qrz.com", name: "QRZ Forums", niche: "ham radio", program: "xenforo1", feed: "https://forums.qrz.com/index.php?forums/-/index.rss" },
  { host: "transmission1.net", name: "Transmission1", niche: "ham radio", program: "phpbb3", feed: "https://www.transmission1.net/app.php/feed/topics" },
  { host: "worldwidedx.com", name: "WorldwideDX Radio Forum", niche: "ham radio", program: "xenforo2", feed: "https://www.worldwidedx.com/forums/-/index.rss" },
  { host: "forum.hifiguides.com", name: "HiFiGuides Forum", niche: "headphones and portable audio", program: "discourse", feed: "https://forum.hifiguides.com/latest.json?order=created" },
  { host: "superbestaudiofriends.org", name: "Super Best Audio Friends", niche: "headphones and portable audio", program: "xenforo1", feed: "https://www.superbestaudiofriends.org/index.php?forums/-/index.rss" },
  { host: "audiosciencereview.com", name: "Audio Science Review", niche: "home audio and hi-fi", program: "xenforo2", feed: "https://www.audiosciencereview.com/forum/index.php?forums/-/index.rss" },
  { host: "head-fi.org", name: "Head-Fi", niche: "home audio and hi-fi", program: "xenforo2", feed: "https://www.head-fi.org/forums/-/index.rss" },
  { host: "aussiehomebrewer.com", name: "Aussie Home Brewer", niche: "home brewing", program: "xenforo2", feed: "https://aussiehomebrewer.com/forums/-/index.rss" },
  { host: "homebrewersassociation.org", name: "American Homebrewers Association Forum", niche: "home brewing", program: "discourse", feed: "https://forum.homebrewersassociation.org/latest.json?order=created" },
  { host: "homebrewtalk.com", name: "Homebrew Talk", niche: "home brewing", program: "xenforo2", feed: "https://www.homebrewtalk.com/forums/-/index.rss" },
  { host: "thehomebrewforum.co.uk", name: "The Homebrew Forum", niche: "home brewing", program: "xenforo2", feed: "https://www.thehomebrewforum.co.uk/forums/-/index.rss" },
  { host: "contractortalk.com", name: "Contractor Talk", niche: "home improvement and DIY", program: "xenforo2", feed: "https://www.contractortalk.com/forums/-/index.rss" },
  { host: "doityourself.com", name: "DoItYourself Community Forums", niche: "home improvement and DIY", program: "vbulletin4", feed: "https://www.doityourself.com/forum/external.php?type=RSS2" },
  { host: "houserepairtalk.com", name: "House Repair Talk", niche: "home improvement and DIY", program: "xenforo2", feed: "https://www.houserepairtalk.com/forums/-/index.rss" },
  { host: "avnirvana.com", name: "AV NIRVANA", niche: "home theater", program: "xenforo2", feed: "https://www.avnirvana.com/forums/-/index.rss" },
  { host: "hometheaterforum.com", name: "Home Theater Forum", niche: "home theater", program: null, feed: "https://www.hometheaterforum.com/feed/" },
  { host: "archerytalk.com", name: "ArcheryTalk", niche: "hunting", program: "xenforo2", feed: "https://www.archerytalk.com/forums/-/index.rss" },
  { host: "hunttalk.com", name: "Hunt Talk", niche: "hunting", program: "xenforo2", feed: "https://www.hunttalk.com/forums/-/index.rss" },
  { host: "longrangehunting.com", name: "Long Range Hunting", niche: "hunting", program: "xenforo2", feed: "https://www.longrangehunting.com/forums/-/index.rss" },
  { host: "rokslide.com", name: "Rokslide", niche: "hunting", program: "xenforo2", feed: "https://rokslide.com/forums/forums/-/index.rss" },
  { host: "diychatroom.com", name: "DIY Chatroom \u2014 HVAC Discussions", niche: "HVAC", program: "xenforo2", feed: "https://www.diychatroom.com/forums/-/index.rss" },
  { host: "forum.heatinghelp.com", name: "Heating Help \u2014 The Wall", niche: "HVAC", program: null, feed: "https://forum.heatinghelp.com/discussions/feed.rss" },
  { host: "hvac-talk.com", name: "HVAC-Talk", niche: "HVAC", program: "xenforo2", feed: "https://hvac-talk.com/forums/-/index.rss" },
  { host: "hvacsite.com", name: "HVAC Site", niche: "HVAC", program: "xenforo2", feed: "https://www.hvacsite.com/forums/-/index.rss" },
  { host: "bladeforums.com", name: "BladeForums", niche: "knives and everyday carry", program: "xenforo2", feed: "https://www.bladeforums.com/forums/-/index.rss" },
  { host: "kitchenknifeforums.com", name: "Kitchen Knife Forums", niche: "knives and everyday carry", program: "xenforo2", feed: "https://www.kitchenknifeforums.com/forums/-/index.rss" },
  { host: "knifedogs.com", name: "KnifeDogs", niche: "knives and everyday carry", program: "xenforo2", feed: "https://knifedogs.com/forums/-/index.rss" },
  { host: "lawnmowerforum.com", name: "Lawn Mower Forum", niche: "lawn care", program: "xenforo2", feed: "https://www.lawnmowerforum.com/forums/-/index.rss" },
  { host: "lawnsite.com", name: "LawnSite", niche: "lawn care", program: "xenforo2", feed: "https://www.lawnsite.com/forums/-/index.rss" },
  { host: "mytractorforum.com", name: "My Tractor Forum", niche: "lawn care", program: "xenforo2", feed: "https://www.mytractorforum.com/forums/-/index.rss" },
  { host: "thelawnforum.com", name: "The Lawn Forum", niche: "lawn care", program: "xenforo2", feed: "https://www.thelawnforum.com/forums/-/index.rss" },
  { host: "tractorbynet.com", name: "TractorByNet", niche: "lawn care", program: "xenforo2", feed: "https://www.tractorbynet.com/forums/forums/-/index.rss" },
  { host: "hifi4sale.net", name: "HiFi4Sale", niche: "Malaysia consumer and tech", program: "phpbb3", feed: "https://www.hifi4sale.net/feed/?f=1" },
  { host: "photomalaysia.com", name: "PhotoMalaysia", niche: "Malaysia consumer and tech", program: null, feed: "https://www.photomalaysia.com/feed/" },
  { host: "zerotohundred.com", name: "Zerotohundred Forums", niche: "Malaysia consumer and tech", program: "xenforo2", feed: "https://www.zerotohundred.com/forums/forums/-/index.rss" },
  { host: "deskthority.net", name: "Deskthority", niche: "mechanical keyboards", program: "phpbb3", feed: "https://deskthority.net/feed/topics" },
  { host: "geekhack.org", name: "Geekhack", niche: "mechanical keyboards", program: "smf2", feed: "https://geekhack.org/index.php?action=.xml;type=rss2;sa=news" },
  { host: "keebtalk.com", name: "KeebTalk", niche: "mechanical keyboards", program: "discourse", feed: "https://www.keebtalk.com/latest.json?order=created" },
  { host: "forums.androidcentral.com", name: "Android Central Forums", niche: "mobile phones", program: "xenforo2", feed: "https://forums.androidcentral.com/forums/-/index.rss" },
  { host: "forums.macrumors.com", name: "MacRumors Forums", niche: "mobile phones", program: "xenforo2", feed: "https://forums.macrumors.com/forums/-/index.rss" },
  { host: "howardforums.com", name: "HowardForums", niche: "mobile phones", program: "xenforo2", feed: "https://www.howardforums.com/forums/-/index.rss" },
  { host: "xdaforums.com", name: "XDA Forums", niche: "mobile phones", program: "xenforo2", feed: "https://xdaforums.com/forums/-/index.rss" },
  { host: "forums.bmwmoa.org", name: "BMW Motorcycle Owners of America Forums", niche: "motorcycles", program: "xenforo2", feed: "https://forums.bmwmoa.org/forums/-/index.rss" },
  { host: "harley-davidsonforums.com", name: "Harley Davidson Forums", niche: "motorcycles", program: "xenforo2", feed: "https://www.harley-davidsonforums.com/forums/-/index.rss" },
  { host: "hdforums.com", name: "HDForums", niche: "motorcycles", program: "vbulletin4", feed: "https://www.hdforums.com/forum/external.php?type=RSS2" },
  { host: "triumphrat.net", name: "TriumphRat", niche: "motorcycles", program: "xenforo2", feed: "https://www.triumphrat.net/forums/-/index.rss" },
  { host: "mothering.com", name: "Mothering Forums", niche: "parenting", program: "xenforo2", feed: "https://www.mothering.com/forums/-/index.rss" },
  { host: "mumsnet.com", name: "Mumsnet Talk", niche: "parenting", program: null, feed: "https://www.mumsnet.com/talk/feed" },
  { host: "netmums.com", name: "Netmums Coffeehouse", niche: "parenting", program: null, feed: "https://www.netmums.com/feed" },
  { host: "forums.overclockers.co.uk", name: "Overclockers UK Forums", niche: "PC building and hardware", program: "xenforo2", feed: "https://forums.overclockers.co.uk/forums/-/index.rss" },
  { host: "forums.tomshardware.com", name: "Tom's Hardware Forums", niche: "PC building and hardware", program: "xenforo2", feed: "https://forums.tomshardware.com/forums/-/index.rss" },
  { host: "hardforum.com", name: "HardForum", niche: "PC building and hardware", program: "xenforo2", feed: "https://hardforum.com/forums/-/index.rss" },
  { host: "overclock.net", name: "Overclock.net", niche: "PC building and hardware", program: "xenforo2", feed: "https://www.overclock.net/forums/-/index.rss" },
  { host: "cameraderie.org", name: "Cameraderie", niche: "photography and cameras", program: "xenforo2", feed: "https://cameraderie.org/forums/-/index.rss" },
  { host: "dpreview.com", name: "DPReview Forums", niche: "photography and cameras", program: "xenforo2", feed: "https://www.dpreview.com/forums/forums/-/index.rss" },
  { host: "pentaxforums.com", name: "Pentax Forums", niche: "photography and cameras", program: "vbulletin4", feed: "https://www.pentaxforums.com/forums/external.php?type=RSS2" },
  { host: "talkphotography.co.uk", name: "Talk Photography", niche: "photography and cameras", program: "xenforo2", feed: "https://www.talkphotography.co.uk/forums/-/index.rss" },
  { host: "diynot.com", name: "DIYnot", niche: "plumbing", program: "xenforo2", feed: "https://www.diynot.com/diy/forums/-/index.rss" },
  { host: "plumbersforums.net", name: "PlumbersForums.net", niche: "plumbing", program: "xenforo2", feed: "https://www.plumbersforums.net/forums/-/index.rss" },
  { host: "plumbingforums.com", name: "Plumbing Forums", niche: "plumbing", program: "xenforo2", feed: "https://www.plumbingforums.com/forums/-/index.rss" },
  { host: "plumbingzone.com", name: "Plumbing Zone", niche: "plumbing", program: "xenforo2", feed: "https://www.plumbingzone.com/forums/-/index.rss" },
  { host: "terrylove.com", name: "Terry Love Plumbing Advice & Remodel Forum", niche: "plumbing", program: "xenforo2", feed: "https://terrylove.com/forums/index.php?forums/-/index.rss" },
  { host: "garagejournal.com", name: "The Garage Journal", niche: "power tools", program: "xenforo2", feed: "https://www.garagejournal.com/forum/forums/-/index.rss" },
  { host: "lumberjocks.com", name: "LumberJocks", niche: "power tools", program: "xenforo2", feed: "https://www.lumberjocks.com/forums/-/index.rss" },
  { host: "sawmillcreek.org", name: "Sawmill Creek", niche: "power tools", program: "xenforo2", feed: "https://sawmillcreek.org/forums/-/index.rss" },
  { host: "woodworkingtalk.com", name: "Woodworking Talk", niche: "power tools", program: "xenforo2", feed: "https://www.woodworkingtalk.com/forums/-/index.rss" },
  { host: "forum.slowtwitch.com", name: "Slowtwitch Forum \u2014 triathlon and endurance running", niche: "running", program: "discourse", feed: "https://forum.slowtwitch.com/latest.json?order=created" },
  { host: "runnersforum.co.uk", name: "Runners Forum", niche: "running", program: "xenforo2", feed: "https://www.runnersforum.co.uk/forums/-/index.rss" },
  { host: "airforums.com", name: "AIR Forums", niche: "RVs and camping", program: "xenforo2", feed: "https://www.airforums.com/forums/-/index.rss" },
  { host: "forestriverforums.com", name: "Forest River Forums", niche: "RVs and camping", program: "xenforo2", feed: "https://www.forestriverforums.com/forums/-/index.rss" },
  { host: "irv2.com", name: "iRV2 Forums", niche: "RVs and camping", program: "xenforo2", feed: "https://www.irv2.com/forums/-/index.rss" },
  { host: "jaycoowners.com", name: "Jayco Owners Forum", niche: "RVs and camping", program: "xenforo2", feed: "https://www.jaycoowners.com/forums/-/index.rss" },
  { host: "keystoneforums.com", name: "Keystone RV Forums", niche: "RVs and camping", program: "xenforo2", feed: "https://www.keystoneforums.com/forums/-/index.rss" },
  { host: "rvforum.net", name: "The RV Forum Community", niche: "RVs and camping", program: "xenforo2", feed: "https://www.rvforum.net/forums/-/index.rss" },
  { host: "avforums.com", name: "AVForums", niche: "smart home", program: "xenforo2", feed: "https://www.avforums.com/forums/-/index.rss" },
  { host: "avsforum.com", name: "AVS Forum", niche: "smart home", program: "xenforo2", feed: "https://www.avsforum.com/forums/-/index.rss" },
  { host: "cocoontech.com", name: "CocoonTech", niche: "smart home", program: "xenforo2", feed: "https://cocoontech.com/forums/-/index.rss" },
  { host: "ipcamtalk.com", name: "IP Cam Talk", niche: "smart home", program: "xenforo2", feed: "https://ipcamtalk.com/forums/-/index.rss" },
  { host: "forums.thefashionspot.com", name: "The Fashion Spot", niche: "sneakers and streetwear", program: "xenforo2", feed: "https://forums.thefashionspot.com/forums/-/index.rss" },
  { host: "kanyetothe.com", name: "KanyeToThe", niche: "sneakers and streetwear", program: "xenforo2", feed: "https://www.kanyetothe.com/forums/-/index.rss" },
  { host: "niketalk.com", name: "NikeTalk", niche: "sneakers and streetwear", program: "xenforo2", feed: "https://niketalk.com/forums/-/index.rss" },
  { host: "styleforum.net", name: "Styleforum", niche: "sneakers and streetwear", program: "xenforo2", feed: "https://www.styleforum.net/forums/-/index.rss" },
  { host: "diysolarforum.com", name: "DIY Solar Power Forum", niche: "solar and off-grid power", program: "xenforo2", feed: "https://diysolarforum.com/forums/-/index.rss" },
  { host: "secondlifestorage.com", name: "Second Life Storage & Solar", niche: "solar and off-grid power", program: "xenforo2", feed: "https://secondlifestorage.com/index.php?forums/-/index.rss" },
  { host: "omegaforums.net", name: "Omega Forums", niche: "watches", program: null, feed: "https://omegaforums.net/forums/-/index.rss" },
  { host: "rolexforums.com", name: "Rolex Forums", niche: "watches", program: "vbulletin4", feed: "https://www.rolexforums.com/external.php?type=RSS2" },
  { host: "thewatchforum.co.uk", name: "The Watch Forum", niche: "watches", program: "xenforo2", feed: "https://www.thewatchforum.co.uk/forums/-/index.rss" },
  { host: "watchuseek.com", name: "Watchuseek", niche: "watches", program: "xenforo2", feed: "https://www.watchuseek.com/forums/-/index.rss" },
  { host: "ukworkshop.co.uk", name: "UK Workshop", niche: "woodworking", program: "xenforo2", feed: "https://www.ukworkshop.co.uk/forums/-/index.rss" },
  { host: "woodworkforums.com", name: "Woodwork Forums", niche: "woodworking", program: "vbulletin4", feed: "https://www.woodworkforums.com/external.php?type=RSS2" },
];

/**
 * The forums one run reads: `count` niches, the next ones each run, and in
 * each niche its next forum (owner, 2026-11-03: "12 forums from different
 * niche hourly, so all niche can get evenly"). Niche picks are numbered from
 * the first run on; a niche is picked every `niches / count` runs, and each
 * pick moves it to its next forum. Facebook groups take turns the same way
 * (US-518).
 */
export function forumsForTurn<T extends { readonly niche: string } = KnownForum>(
  turn: number,
  count: number,
  forums: readonly T[] = knownForums as unknown as readonly T[],
): T[] {
  const byNiche = new Map<string, T[]>();
  for (const forum of forums) {
    const list = byNiche.get(forum.niche) ?? [];
    list.push(forum);
    byNiche.set(forum.niche, list);
  }
  const niches = [...byNiche.keys()].sort();
  const picked: T[] = [];
  for (let index = 0; index < Math.min(count, niches.length); index += 1) {
    const pick = turn * count + index;
    const list = byNiche.get(niches[pick % niches.length] as string) as T[];
    picked.push(list[Math.floor(pick / niches.length) % list.length] as T);
  }
  return picked;
}
