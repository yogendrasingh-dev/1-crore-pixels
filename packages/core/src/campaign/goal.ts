// Campaign goal constant — PRD §1/§2 ("₹1 crore campaign goal"). A fixed product target,
// not an Open Decision, so unlike amount bounds/wall geometry this is not env-configurable.
export const CAMPAIGN_GOAL_RUPEES = 10_000_000;
export const CAMPAIGN_GOAL_PAISE = BigInt(CAMPAIGN_GOAL_RUPEES) * 100n;
