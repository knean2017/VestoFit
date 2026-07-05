export type Plan = {
  id: string;
  name: string;
  price: string;
  period: string;
  variantId: string;
  features: string[];
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    variantId: "",
    features: [
      "Full wardrobe management",
      "5 try-on renders / month",
      "Limited stylist chat",
      "Basic outfit suggestions",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$9.99",
    period: "/ month",
    variantId: "LEMON_PRO_VARIANT_ID",
    highlight: true,
    features: [
      "50 try-on renders / month",
      "Unlimited stylist chat",
      "Shopping assistant",
      "Full-outfit renders",
      "Priority support",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: "$19.99",
    period: "/ month",
    variantId: "LEMON_PREMIUM_VARIANT_ID",
    features: [
      "Unlimited try-on renders",
      "Priority rendering queue",
      "Early access to features",
      "Everything in Pro",
    ],
  },
];
