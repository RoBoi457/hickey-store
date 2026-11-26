export const KEYCHAIN_CATALOG = {
  "kathor-clock": { name: "The Rohtak Clock", price: 69, category: "keychain" },
  pda: { name: "PDA Tree", price: 69, category: "keychain" },
  "submit-mode": { name: "Spiderman", price: 69, category: "keychain" },
  "clock-it": { name: "Clock It", price: 69, category: "keychain" },
  "coke-paglu": { name: "Diet Coke Paglu", price: 69, category: "keychain" },
  cooks: { name: "Cooked", price: 69, category: "keychain" },
  "proxy-pass": { name: "Claudey Proxy Mat Laga", price: 69, category: "keychain" },
  baddie: { name: "The Baddie Club", price: 69, category: "keychain" },
  "kathor-land": { name: "Kathor Land", price: 69, category: "keychain" },
  nonchalant: { name: "Non Chalant", price: 69, category: "keychain" },
  "two-friends": { name: "Couple Design", price: 99, category: "keychain" },
  "campus-cat-nap": { name: "CAT Whore", price: 69, category: "keychain" },
  "clinger-cat-club": { name: "Gingerrrrr", price: 69, category: "keychain" },
  "same-old-day": { name: "CAT checklist", price: 69, category: "keychain" }
};

export const STICKER_ENTRIES = [
  // Campus & Hostel (12)
  ["stk-01", "75% Survivor", 29],
  ["stk-02", "Proxy Certified", 29],
  ["stk-03", "Mess Food Critic", 29],
  ["stk-04", "Dorm 17 Energy", 29],
  ["stk-05", "Late Night Maggi", 29],
  ["stk-06", "8:30 AM Regret", 29],
  ["stk-07", "Campus Cat Whisperer", 29],
  ["stk-08", "Library Nap Club", 29],
  ["stk-09", "Zero Attendance Hero", 29],
  ["stk-10", "Hostel Wi-Fi Loading", 29],
  ["stk-11", "Canteen Credit", 29],
  ["stk-12", "Endsem Delulu", 39],

  // Internet & Slang (12)
  ["stk-13", "Cooked Beyond Repair", 29],
  ["stk-14", "Certified Paglu", 29],
  ["stk-15", "Nonchalant Final Boss", 29],
  ["stk-16", "Clock It Bestie", 29],
  ["stk-17", "Main Character Only", 29],
  ["stk-18", "Lowkey Iconic", 29],
  ["stk-19", "Delulu Is Solulu", 29],
  ["stk-20", "No Thoughts Just Vibes", 29],
  ["stk-21", "Touch Grass Later", 29],
  ["stk-22", "Chronically Online", 29],
  ["stk-23", "Side Eye Specialist", 29],
  ["stk-24", "Plot Twist Pending", 39],

  // Caffeine & Survival (12)
  ["stk-25", "Diet Coke Fuel", 29],
  ["stk-26", "Iced Latte First", 29],
  ["stk-27", "Chai Tapri Regular", 29],
  ["stk-28", "2 AM Brainwave", 29],
  ["stk-29", "Sleep Is Optional", 29],
  ["stk-30", "Espresso Depresso", 29],
  ["stk-31", "Cold Coffee Cult", 29],
  ["stk-32", "Zero Sleep Club", 29],
  ["stk-33", "Running On Vibes", 29],
  ["stk-34", "Caffeine & Chaos", 29],
  ["stk-35", "Midnight Cravings", 29],
  ["stk-36", "Hydrate Or Diedrate", 39],

  // Cats & Chaos (12)
  ["stk-37", "Ginger Cat Energy", 29],
  ["stk-38", "Clinger Cat Club", 29],
  ["stk-39", "Unbothered Feline", 29],
  ["stk-40", "Purr-fectly Chaotic", 29],
  ["stk-41", "Campus Cat CEO", 29],
  ["stk-42", "Meow Means Now", 29],
  ["stk-43", "Feral But Cute", 29],
  ["stk-44", "Nap First Ask Later", 29],
  ["stk-45", "Paw-sitive Drama", 29],
  ["stk-46", "Cat Tax Paid", 29],
  ["stk-47", "Orange Braincell", 29],
  ["stk-48", "Handle With Awww", 39],

  // Aesthetic & Badges (12)
  ["stk-49", "Belong Out Loud", 39],
  ["stk-50", "Hickey Club Seal", 39],
  ["stk-51", "Stay Weird", 29],
  ["stk-52", "Good Energy Only", 29],
  ["stk-53", "Certified Icon", 29],
  ["stk-54", "Limited Drop 01", 39],
  ["stk-55", "Handle With Heart", 29],
  ["stk-56", "Too Cool For Normal", 29],
  ["stk-57", "Campus Lore Archive", 29],
  ["stk-58", "Approved By Vibes", 29],
  ["stk-59", "Made To Keep", 29],
  ["stk-60", "Zero Boring Stuff", 39]
];

export const STICKER_CATALOG = Object.fromEntries(
  STICKER_ENTRIES.map(([id, name, price]) => [id, { name: `${name} Sticker`, price, category: "sticker" }])
);

export const CATALOG = {
  ...KEYCHAIN_CATALOG,
  ...STICKER_CATALOG
};
