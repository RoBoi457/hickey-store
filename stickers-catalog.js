(() => {
  const PALETTES = [
    ["#121a2b", "#ffffff", "#ed2442"],
    ["#ed2442", "#ffffff", "#ffd966"],
    ["#173b6c", "#f4f8ff", "#45baf0"],
    ["#fff3d6", "#121a2b", "#ed2442"],
    ["#1d2b24", "#e8fff1", "#4ee09b"],
    ["#2c1836", "#fff1fb", "#ff7eb6"],
    ["#f2e9ff", "#1f1638", "#7c3aed"],
    ["#e6f6ff", "#0f2744", "#0284c7"],
    ["#ffecee", "#2b1219", "#e11d48"],
    ["#111827", "#f8fafc", "#38bdf8"]
  ];

  const SHAPES = ["pill", "stamp", "circle", "ticket", "badge", "hex"];

  // [id, name, price, pack, tagline, shortCode, badge?]
  const RAW_STICKERS = [
    // Campus & Hostel (12)
    ["stk-01", "75% Survivor", 29, "Campus & Hostel", "Barely made the cutoff, still undefeated.", "75%"],
    ["stk-02", "Proxy Certified", 29, "Campus & Hostel", "Attendance secured by loyal wingmates.", "PRXY"],
    ["stk-03", "Mess Food Critic", 29, "Campus & Hostel", "Five-star opinions on two-star dal.", "MESS"],
    ["stk-04", "Dorm 17 Energy", 29, "Campus & Hostel", "Zero silence after midnight.", "D-17"],
    ["stk-05", "Late Night Maggi", 29, "Campus & Hostel", "Kettle cuisine at 2:14 AM.", "2AM"],
    ["stk-06", "8:30 AM Regret", 29, "Campus & Hostel", "Why did we sign up for morning slots.", "8:30"],
    ["stk-07", "Campus Cat Whisperer", 29, "Campus & Hostel", "On first-name terms with every stray.", "CATS"],
    ["stk-08", "Library Nap Club", 29, "Campus & Hostel", "AC on full, textbook as a pillow.", "ZZZ"],
    ["stk-09", "Zero Attendance Hero", 29, "Campus & Hostel", "Living dangerously on the roll sheet.", "0%"],
    ["stk-10", "Hostel Wi-Fi Loading", 29, "Campus & Hostel", "Buffering since orientation week.", "WIFI"],
    ["stk-11", "Canteen Credit", 29, "Campus & Hostel", "Will pay after the next allowance.", "IOU"],
    ["stk-12", "Endsem Delulu", 39, "Campus & Hostel", "One night, fourteen chapters, pure faith.", "EXAM", "Holo"],

    // Internet & Slang (12)
    ["stk-13", "Cooked Beyond Repair", 29, "Internet & Slang", "Medium rare? No, completely charred.", "COOK"],
    ["stk-14", "Certified Paglu", 29, "Internet & Slang", "Zero chill, maximum devotion.", "PGLU"],
    ["stk-15", "Nonchalant Final Boss", 29, "Internet & Slang", "Unbothered at olympic levels.", "BOSS"],
    ["stk-16", "Clock It Bestie", 29, "Internet & Slang", "Noticed everything, said nothing.", "CLCK"],
    ["stk-17", "Main Character Only", 29, "Internet & Slang", "Everyone else is an extra.", "MC01"],
    ["stk-18", "Lowkey Iconic", 29, "Internet & Slang", "Quietly carrying the whole vibe.", "ICON"],
    ["stk-19", "Delulu Is Solulu", 29, "Internet & Slang", "Manifesting harder than studying.", "DLLU"],
    ["stk-20", "No Thoughts Just Vibes", 29, "Internet & Slang", "Brain smoothly offline.", "VIBE"],
    ["stk-21", "Touch Grass Later", 29, "Internet & Slang", "Screen time is a personal record.", "GRSS"],
    ["stk-22", "Chronically Online", 29, "Internet & Slang", "Already saw that reel yesterday.", "24/7"],
    ["stk-23", "Side Eye Specialist", 29, "Internet & Slang", "Judging silently from the back row.", "EYES"],
    ["stk-24", "Plot Twist Pending", 39, "Internet & Slang", "Season finale energy every week.", "PLOT", "Holo"],

    // Caffeine & Survival (12)
    ["stk-25", "Diet Coke Fuel", 29, "Caffeine & Survival", "Crisp, cold, and legally a personality.", "COKE"],
    ["stk-26", "Iced Latte First", 29, "Caffeine & Survival", "Do not speak before sip three.", "ICED"],
    ["stk-27", "Chai Tapri Regular", 29, "Caffeine & Survival", "Cutting chai solves 90% of crises.", "CHAI"],
    ["stk-28", "2 AM Brainwave", 29, "Caffeine & Survival", "Best ideas arrive when sleep should.", "IDEA"],
    ["stk-29", "Sleep Is Optional", 29, "Caffeine & Survival", "Dark circles are just free eyeliner.", "NOZZ"],
    ["stk-30", "Espresso Depresso", 29, "Caffeine & Survival", "Double shot of existential clarity.", "SHOT"],
    ["stk-31", "Cold Coffee Cult", 29, "Caffeine & Survival", "Shaken, sweet, and campus-approved.", "COLD"],
    ["stk-32", "Zero Sleep Club", 29, "Caffeine & Survival", "Running purely on deadlines and ice.", "CLUB"],
    ["stk-33", "Running On Vibes", 29, "Caffeine & Survival", "Fuel gauge empty, spirit full.", "FUEL"],
    ["stk-34", "Caffeine & Chaos", 29, "Caffeine & Survival", "Two food groups, one lifestyle.", "BREW"],
    ["stk-35", "Midnight Cravings", 29, "Caffeine & Survival", "Ordering snacks with zero remorse.", "SNK"],
    ["stk-36", "Hydrate Or Diedrate", 39, "Caffeine & Survival", "Friendly reminder from your bottle.", "H2O", "Holo"],

    // Cats & Chaos (12)
    ["stk-37", "Ginger Cat Energy", 29, "Cats & Chaos", "Chaotic, loud, and impossible to stay mad at.", "GNGR"],
    ["stk-38", "Clinger Cat Club", 29, "Cats & Chaos", "Velcro energy at all hours.", "CLNG"],
    ["stk-39", "Unbothered Feline", 29, "Cats & Chaos", "Knocked it off the desk on purpose.", "MEOW"],
    ["stk-40", "Purr-fectly Chaotic", 29, "Cats & Chaos", "Cute enough to escape consequences.", "PURR"],
    ["stk-41", "Campus Cat CEO", 29, "Cats & Chaos", "Owns the quad, pays zero tuition.", "CEO"],
    ["stk-42", "Meow Means Now", 29, "Cats & Chaos", "Immediate treats or immediate drama.", "NOW!"],
    ["stk-43", "Feral But Cute", 29, "Cats & Chaos", "Approach slowly with snacks.", "CUTE"],
    ["stk-44", "Nap First Ask Later", 29, "Cats & Chaos", "Eighteen hours is a light warm-up.", "NAP"],
    ["stk-45", "Paw-sitive Drama", 29, "Cats & Chaos", "Soft paws, sharp commentary.", "PAWS"],
    ["stk-46", "Cat Tax Paid", 29, "Cats & Chaos", "Official campus petter clearance.", "PAID"],
    ["stk-47", "Orange Braincell", 29, "Cats & Chaos", "Currently waiting for its turn.", "ORNG"],
    ["stk-48", "Handle With Awww", 39, "Cats & Chaos", "Fragile ego, elite cuteness.", "AWWW", "Holo"],

    // Aesthetic & Badges (12)
    ["stk-49", "Belong Out Loud", 39, "Aesthetic & Badges", "The flagship Hickey vinyl seal.", "HKY", "Icon"],
    ["stk-50", "Hickey Club Seal", 39, "Aesthetic & Badges", "Official member of the inside joke.", "SEAL", "Icon"],
    ["stk-51", "Stay Weird", 29, "Aesthetic & Badges", "Normal was never the brief.", "WIRD"],
    ["stk-52", "Good Energy Only", 29, "Aesthetic & Badges", "Checked at the door.", "GOOD"],
    ["stk-53", "Certified Icon", 29, "Aesthetic & Badges", "No further credentials required.", "CERT"],
    ["stk-54", "Limited Drop 01", 39, "Aesthetic & Badges", "First-edition sticker archive.", "DRP1", "Holo"],
    ["stk-55", "Handle With Heart", 29, "Aesthetic & Badges", "Made for laptops, bottles, and trunks.", "HART"],
    ["stk-56", "Too Cool For Normal", 29, "Aesthetic & Badges", "Zero plain notebooks allowed.", "COOL"],
    ["stk-57", "Campus Lore Archive", 29, "Aesthetic & Badges", "Collected memories, peel-and-stick.", "LORE"],
    ["stk-58", "Approved By Vibes", 29, "Aesthetic & Badges", "Passed the group-chat review.", "OKAY"],
    ["stk-59", "Made To Keep", 29, "Aesthetic & Badges", "Weatherproof matte vinyl finish.", "KEEP"],
    ["stk-60", "Zero Boring Stuff", 39, "Aesthetic & Badges", "Our one and only rule.", "ZERO", "Icon"]
  ];

  function esc(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function splitTitle(title) {
    const words = title.split(" ");
    if (words.length <= 2) return [title, ""];
    const mid = Math.ceil(words.length / 2);
    return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
  }

  function createStickerDataUrl(item, index) {
    const [bg, fg, accent] = PALETTES[index % PALETTES.length];
    const shape = SHAPES[index % SHAPES.length];
    const [line1, line2] = splitTitle(item.title);
    const rot = ((index % 5) - 2) * 2.2;
    const isHolo = item.badge === "Holo" || item.badge === "Icon";
    const num = String(index + 1).padStart(2, "0");

    let outerShape = "";
    let innerShape = "";
    if (shape === "circle") {
      outerShape = `<circle cx="150" cy="150" r="112" fill="#ffffff"/>`;
      innerShape = `<circle cx="150" cy="150" r="98" fill="${bg}" stroke="${accent}" stroke-width="4"/>`;
    } else if (shape === "pill") {
      outerShape = `<rect x="24" y="64" width="252" height="172" rx="86" fill="#ffffff"/>`;
      innerShape = `<rect x="36" y="76" width="228" height="148" rx="74" fill="${bg}" stroke="${accent}" stroke-width="4"/>`;
    } else if (shape === "ticket") {
      outerShape = `<rect x="26" y="56" width="248" height="188" rx="28" fill="#ffffff"/>`;
      innerShape = `<rect x="38" y="68" width="224" height="164" rx="20" fill="${bg}" stroke="${accent}" stroke-width="3.5" stroke-dasharray="10 6"/>`;
    } else if (shape === "hex") {
      outerShape = `<polygon points="150,28 258,88 258,212 150,272 42,212 42,88" fill="#ffffff" stroke="#ffffff" stroke-width="18" stroke-linejoin="round"/>`;
      innerShape = `<polygon points="150,42 246,96 246,204 150,258 54,204 54,96" fill="${bg}" stroke="${accent}" stroke-width="4" stroke-linejoin="round"/>`;
    } else if (shape === "stamp") {
      outerShape = `<rect x="34" y="34" width="232" height="232" rx="34" fill="#ffffff"/>`;
      innerShape = `<rect x="46" y="46" width="208" height="208" rx="24" fill="${bg}" stroke="${accent}" stroke-width="4"/>`;
    } else {
      outerShape = `<rect x="30" y="48" width="240" height="204" rx="46" fill="#ffffff"/>`;
      innerShape = `<rect x="42" y="60" width="216" height="180" rx="36" fill="${bg}" stroke="${accent}" stroke-width="4"/>`;
    }

    const titleY1 = line2 ? 154 : 165;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
      <defs>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="9" flood-color="#121a2b" flood-opacity="0.16"/>
        </filter>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="${isHolo ? "0.28" : "0.14"}"/>
          <stop offset="50%" stop-color="#45baf0" stop-opacity="${isHolo ? "0.14" : "0.02"}"/>
          <stop offset="100%" stop-color="#ed2442" stop-opacity="${isHolo ? "0.18" : "0"}"/>
        </linearGradient>
      </defs>
      <g transform="rotate(${rot} 150 150)" filter="url(#s)">
        ${outerShape}
        ${innerShape}
        <text x="150" y="106" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="800" letter-spacing="2.8" fill="${accent}">✦ HICKEY · #${num}</text>
        <text x="150" y="${titleY1}" text-anchor="middle" font-family="Georgia,serif" font-size="${line1.length > 14 ? 20 : 23}" font-weight="700" fill="${fg}">${esc(line1)}</text>
        ${line2 ? `<text x="150" y="182" text-anchor="middle" font-family="Georgia,serif" font-size="${line2.length > 14 ? 19 : 22}" font-weight="700" fill="${fg}">${esc(line2)}</text>` : ""}
        <rect x="108" y="201" width="84" height="22" rx="11" fill="${accent}" opacity="0.92"/>
        <text x="150" y="216" text-anchor="middle" font-family="system-ui,-apple-system,sans-serif" font-size="11" font-weight="800" letter-spacing="1.6" fill="${accent === "#ffd966" || accent === "#4ee09b" || accent === "#45baf0" ? "#121a2b" : "#ffffff"}">${esc(item.code)}</text>
        <rect x="34" y="34" width="232" height="232" rx="40" fill="url(#g)" pointer-events="none"/>
      </g>
    </svg>`;

    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  const STICKERS = RAW_STICKERS.map(([id, title, price, pack, description, code, badge], index) => {
    const item = {
      id,
      title,
      name: `${title} Sticker`,
      price,
      pack,
      description,
      code,
      badge: badge || "",
      category: "sticker",
      specs: [
        { label: "Size", value: "3 × 3 in (Die-Cut)" },
        { label: "Material", value: badge === "Holo" ? "Holographic Vinyl" : "Waterproof Matte Vinyl" }
      ]
    };
    item.image = createStickerDataUrl(item, index);
    return item;
  });

  window.HickeyStickers = {
    items: STICKERS,
    packs: ["All", "Campus & Hostel", "Internet & Slang", "Caffeine & Survival", "Cats & Chaos", "Aesthetic & Badges"]
  };
})();
