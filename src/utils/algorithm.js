import { DENOMINATIONS } from "../data/profiles";

const WEIGHTS = {
  denominationMatch: 25,
  denominationSimilar: 10,
  interestOverlap: 4,     // per shared interest
  distance: 20,           // closer = higher
  commentLike: 15,        // sent a like with comment (engagement signal)
  doveLike: 20,           // sent a dove (strong intent)
  recentlyActive: 10,
  profileCompleteness: 5,
  dealbreaker: -100,
};

// Denomination similarity groups — denominations that share theological roots
const DENOM_GROUPS = {
  "Catholic": "catholic",
  "Orthodox": "catholic",
  "Protestant": "protestant",
  "Evangelical": "protestant",
  "Reformed": "protestant",
  "Baptist": "protestant",
  "Pentecostal": "protestant",
  "Non-denominational": "independent",
};

function denominationScore(userDenom, profileDenom) {
  if (!userDenom || !profileDenom) return 0;
  if (userDenom === profileDenom) return WEIGHTS.denominationMatch;
  if (DENOM_GROUPS[userDenom] === DENOM_GROUPS[profileDenom]) return WEIGHTS.denominationSimilar;
  return 0;
}

function interestScore(userInterests, profileInterests) {
  if (!userInterests?.length || !profileInterests?.length) return 0;
  const shared = userInterests.filter((i) => profileInterests.includes(i));
  return shared.length * WEIGHTS.interestOverlap;
}

function distanceScore(distance, maxDistance) {
  if (!distance) return 0;
  // Closer profiles score higher — linear decay
  const ratio = 1 - (distance / maxDistance);
  return Math.max(0, ratio * WEIGHTS.distance);
}

function engagementScore(profileId, likes) {
  // Profiles the user engaged with via comments or doves signal preference patterns
  // We use this to boost similar profiles (not the same ones)
  const commentLikes = likes.filter((l) => l.comment);
  const doveLikes = likes.filter((l) => l.isDove);
  // This is a placeholder — in production you'd cluster similar profiles
  return 0;
}

function activityScore(lastActive) {
  if (lastActive === "Just now") return WEIGHTS.recentlyActive;
  if (lastActive === "Today") return WEIGHTS.recentlyActive * 0.6;
  return 0;
}

function completenessScore(profile) {
  let score = 0;
  if (profile.job) score += 1;
  if (profile.school) score += 1;
  if (profile.denomination) score += 1;
  if (profile.prompts?.filter((p) => p.prompt && p.answer).length >= 2) score += 1;
  if (profile.photos?.length >= 3) score += 1;
  return (score / 5) * WEIGHTS.profileCompleteness;
}

// Gale-Shapley inspired: estimate how likely THEY would like YOU
function mutualAttractionEstimate(currentUser, profile) {
  let score = 0;
  score += denominationScore(profile.denomination, currentUser.denomination);
  score += interestScore(profile.interests, currentUser.interests);
  if (currentUser.age) {
    const ageDiff = Math.abs(currentUser.age - profile.age);
    score += Math.max(0, 10 - ageDiff);
  }
  return score * 0.5; // weight mutual score at 50% of direct score
}

// Main scoring function — Hinge-inspired compatibility
export function scoreProfile(profile, currentUser, state) {
  let score = 0;

  // 1. Denomination compatibility
  score += denominationScore(currentUser.denomination, profile.denomination);

  // 2. Shared interests
  score += interestScore(currentUser.interests, profile.interests);

  // 3. Distance (closer = better)
  score += distanceScore(profile.distance, state.filters.maxDistance);

  // 4. Activity recency
  score += activityScore(profile.lastActive);

  // 5. Profile completeness
  score += completenessScore(profile);

  // 6. Mutual attraction estimate (Gale-Shapley component)
  score += mutualAttractionEstimate(currentUser, profile);

  // 7. Standout bonus
  if (profile.isStandout) score += 5;

  // 8. Small random factor to keep feed fresh (±3 points)
  score += (Math.random() - 0.5) * 6;

  return Math.round(score * 10) / 10;
}

// Rank profiles by compatibility score
export function rankProfiles(profiles, currentUser, state) {
  if (!currentUser) return profiles;

  return profiles
    .map((profile) => ({
      ...profile,
      compatibilityScore: scoreProfile(profile, currentUser, state),
    }))
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
}

// Most Compatible — daily top pick with highest mutual score
export function getMostCompatible(profiles, currentUser, state) {
  if (!currentUser || !profiles.length) return null;

  const ranked = rankProfiles(profiles, currentUser, state);
  return ranked[0] || null;
}

// Comment-weighted like scoring — likes with comments worth more
export function scoreLikeQuality(like) {
  let quality = 1;
  if (like.comment) quality += 2;
  if (like.isDove) quality += 3;
  if (like.comment && like.isDove) quality += 1; // combo bonus
  return quality;
}
