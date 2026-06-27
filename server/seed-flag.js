//API
//https://flagcdn.com/w2560/us.png
const COUNTRIES = {
    "ad": "Andorra", "ae": "United Arab Emirates", "af": "Afghanistan", "ag": "Antigua and Barbuda",
    "ai": "Anguilla", "al": "Albania", "am": "Armenia", "ao": "Angola", "ar": "Argentina",
    "at": "Austria", "au": "Australia", "az": "Azerbaijan", "ba": "Bosnia and Herzegovina",
    "bb": "Barbados", "bd": "Bangladesh", "be": "Belgium", "bf": "Burkina Faso", "bg": "Bulgaria",
    "bh": "Bahrain", "bi": "Burundi", "bj": "Benin", "bm": "Bermuda", "bn": "Brunei", "bo": "Bolivia",
    "br": "Brazil", "bs": "Bahamas", "bt": "Bhutan", "bw": "Botswana", "by": "Belarus", "bz": "Belize",
    "ca": "Canada", "cd": "DR Congo", "cf": "Central African Republic", "cg": "Republic of the Congo",
    "ch": "Switzerland", "ci": "Ivory Coast", "cl": "Chile", "cm": "Cameroon", "cn": "China",
    "co": "Colombia", "cr": "Costa Rica", "cu": "Cuba", "cv": "Cape Verde", "cy": "Cyprus",
    "cz": "Czechia", "de": "Germany", "dj": "Djibouti", "dk": "Denmark", "dm": "Dominica",
    "do": "Dominican Republic", "dz": "Algeria", "ec": "Ecuador", "ee": "Estonia", "eg": "Egypt",
    "er": "Eritrea", "es": "Spain", "et": "Ethiopia", "fi": "Finland", "fj": "Fiji", "fr": "France",
    "ga": "Gabon", "gb": "United Kingdom", "gd": "Grenada", "ge": "Georgia", "gh": "Ghana",
    "gm": "Gambia", "gn": "Guinea", "gq": "Equatorial Guinea", "gr": "Greece", "gt": "Guatemala",
    "gw": "Guinea-Bissau", "gy": "Guyana", "hn": "Honduras", "hr": "Croatia", "ht": "Haiti",
    "hu": "Hungary", "id": "Indonesia", "ie": "Ireland", "il": "Israel", "in": "India", "iq": "Iraq",
    "ir": "Iran", "is": "Iceland", "it": "Italy", "jm": "Jamaica", "jo": "Jordan", "jp": "Japan",
    "ke": "Kenya", "kg": "Kyrgyzstan", "kh": "Cambodia", "ki": "Kiribati", "km": "Comoros",
    "kn": "Saint Kitts and Nevis", "kp": "North Korea", "kr": "South Korea", "kw": "Kuwait",
    "kz": "Kazakhstan", "la": "Laos", "lb": "Lebanon", "lc": "Saint Lucia", "li": "Liechtenstein",
    "lk": "Sri Lanka", "lr": "Liberia", "ls": "Lesotho", "lt": "Lithuania", "lu": "Luxembourg",
    "lv": "Latvia", "ly": "Libya", "ma": "Morocco", "mc": "Monaco", "md": "Moldova", "me": "Montenegro",
    "mg": "Madagascar", "mk": "North Macedonia", "ml": "Mali", "mm": "Myanmar", "mn": "Mongolia",
    "mr": "Mauritania", "mt": "Malta", "mu": "Mauritius", "mv": "Maldives", "mw": "Malawi",
    "mx": "Mexico", "my": "Malaysia", "mz": "Mozambique", "na": "Namibia", "ne": "Niger",
    "ng": "Nigeria", "ni": "Nicaragua", "nl": "Netherlands", "no": "Norway", "np": "Nepal",
    "nz": "New Zealand", "om": "Oman", "pa": "Panama", "pe": "Peru", "pg": "Papua New Guinea",
    "ph": "Philippines", "pk": "Pakistan", "pl": "Poland", "pt": "Portugal", "py": "Paraguay",
    "qa": "Qatar", "ro": "Romania", "rs": "Serbia", "ru": "Russia", "rw": "Rwanda", "sa": "Saudi Arabia",
    "sb": "Solomon Islands", "sc": "Seychelles", "sd": "Sudan", "se": "Sweden", "sg": "Singapore",
    "si": "Slovenia", "sk": "Slovakia", "sl": "Sierra Leone", "sm": "San Marino", "sn": "Senegal",
    "so": "Somalia", "sr": "Suriname", "ss": "South Sudan", "st": "Sao Tome and Principe",
    "sv": "El Salvador", "sy": "Syria", "sz": "Eswatini", "td": "Chad", "tg": "Togo", "th": "Thailand",
    "tj": "Tajikistan", "tl": "Timor-Leste", "tm": "Turkmenistan", "tn": "Tunisia", "to": "Tonga",
    "tr": "Turkey", "tt": "Trinidad and Tobago", "tv": "Tuvalu", "tw": "Taiwan", "tz": "Tanzania",
    "ua": "Ukraine", "ug": "Uganda", "us": "United States", "uy": "Uruguay", "uz": "Uzbekistan",
    "va": "Vatican City", "vc": "Saint Vincent and the Grenadines", "ve": "Venezuela", "vn": "Vietnam",
    "vu": "Vanuatu", "ws": "Samoa", "ye": "Yemen", "za": "South Africa", "zm": "Zambia", "zw": "Zimbabwe"
};

require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  try {
    console.log("Ensuring trivia_images table exists...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trivia_images (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        answer TEXT NOT NULL,
        aliases TEXT[] NOT NULL,
        category TEXT NOT NULL
      )
    `);

    // Clear existing flags if user runs this multiple times
    await pool.query("DELETE FROM trivia_images WHERE category = 'flags'");

    console.log("Inserting Flags into database...");
    let inserted = 0;
    for (const [code, name] of Object.entries(COUNTRIES)) {
      const url = `https://flagcdn.com/w2560/${code}.png`;
      const answer = name;

      // Aliases (e.g. Guinea-Bissau -> guinea-bissau, guinea bissau)
      const aliases = [...new Set([name.toLowerCase(), name.toLowerCase().replace(/-/g, ' '), name.toLowerCase().replace(/-/g, '')])];

      await pool.query(
        'INSERT INTO trivia_images (url, answer, aliases, category) VALUES ($1, $2, $3, $4)',
        [url, answer, JSON.stringify(aliases), 'flags']
      );
      inserted++;
      if (inserted % 25 === 0) console.log(`Inserted ${inserted}...`);
    }
    console.log(`Success! Inserted ${inserted} Flags.`);
  } catch (err) {
    console.error("Error seeding:", err);
  } finally {
    pool.end();
  }
}

seed();
