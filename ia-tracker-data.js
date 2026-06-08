/* Iowa 2026 GOP Governor Primary — county data, candidate colors, predictions */
var IA_TRACKER = (function () {

  var CAND_KEYS  = ["lahn","feenstra","steen","sherman","andrews"];
  var CAND_NAMES = { lahn:"Lahn", feenstra:"Feenstra", steen:"Steen", sherman:"Sherman", andrews:"Andrews" };

  /* Georgia GOP primary palette colors, assigned per candidate:
     Lahn     → #dc2626 (red)
     Feenstra → #1d4ed8 (blue)
     Steen    → #eab308 (yellow)
     Andrews  → #7c3aed (purple)
     Sherman  → #0891b2 (cyan)                                             */
  var CAND_COLORS = {
    lahn:     "#dc2626",
    feenstra: "#1d4ed8",
    steen:    "#eab308",
    andrews:  "#7c3aed",
    sherman:  "#0891b2",
  };

  /* CD-level default prediction percentages (from Internal Tracker header rows) */
  var CD_PRED = {
    1:{lahn:.39,feenstra:.34,steen:.17,sherman:.07,andrews:.03},
    2:{lahn:.40,feenstra:.33,steen:.19,sherman:.06,andrews:.02},
    3:{lahn:.38,feenstra:.30,steen:.23,sherman:.06,andrews:.03},
    4:{lahn:.40,feenstra:.38,steen:.14,sherman:.05,andrews:.03}
  };

  /* County-level overrides for top 10 counties (from tracker spreadsheet) */
  var OVRD = {
    "Polk":         {lahn:.33,feenstra:.29,steen:.19,sherman:.06,andrews:.13},
    "Linn":         {lahn:.34,feenstra:.37,steen:.18,sherman:.06,andrews:.05},
    "Scott":        {lahn:.45,feenstra:.28,steen:.20,sherman:.05,andrews:.02},
    "Dallas":       {lahn:.34,feenstra:.27,steen:.32,sherman:.03,andrews:.04},
    "Pottawattamie":{lahn:.25,feenstra:.48,steen:.20,sherman:.03,andrews:.04},
    "Woodbury":     {lahn:.37,feenstra:.38,steen:.13,sherman:.07,andrews:.05},
    "Black Hawk":   {lahn:.51,feenstra:.20,steen:.25,sherman:.02,andrews:.02},
    "Dubuque":      {lahn:.48,feenstra:.32,steen:.14,sherman:.02,andrews:.04},
    "Johnson":      {lahn:.41,feenstra:.28,steen:.16,sherman:.14,andrews:.03},
    "Story":        {lahn:.36,feenstra:.29,steen:.30,sherman:.03,andrews:.02}
  };

  var STATEWIDE_TARGET  = 200000;
  var STATEWIDE_VOTERS  = 774726;

  function recalcPredictions() {
    COUNTIES.forEach(function(c) {
      c.predTurnout = Math.round(STATEWIDE_TARGET * c.voters / STATEWIDE_VOTERS);
    });
    CAND_KEYS.forEach(function(k) {
      var total = 0;
      COUNTIES.forEach(function(c) { total += Math.round(c.predTurnout * c.pred[k]); });
      STATEWIDE_PRED[k] = total;
    });
  }

  /* All 99 Iowa counties: [county, cd, dma, registeredRepVoters, totalPrecincts]
     Voter counts exact for top-10, approximate for remainder (2024 active R registrations). */
  var RAW = [
    ["Adair",         3,"Ottumwa",           3842,  8],
    ["Adams",         3,"Ottumwa",           2180,  5],
    ["Allamakee",     1,"Rochester-MC",      4512,  9],
    ["Appanoose",     2,"Ottumwa",           4023, 10],
    ["Audubon",       4,"Omaha",             3516,  7],
    ["Benton",        1,"Cedar Rapids",      7523, 14],
    ["Black Hawk",    1,"Cedar Rapids",     23204, 48],
    ["Boone",         4,"Des Moines",        7498, 14],
    ["Bremer",        1,"Rochester-MC",      7012, 13],
    ["Buchanan",      1,"Cedar Rapids",      5487, 10],
    ["Buena Vista",   4,"Sioux City",        5523, 10],
    ["Butler",        1,"Rochester-MC",      5498, 10],
    ["Calhoun",       4,"Des Moines",        3987,  8],
    ["Carroll",       4,"Sioux City",        6987, 13],
    ["Cass",          4,"Omaha",             5498, 10],
    ["Cedar",         2,"Cedar Rapids",      6012, 11],
    ["Cerro Gordo",   1,"Rochester-MC",     12023, 22],
    ["Cherokee",      4,"Sioux City",        5512, 10],
    ["Chickasaw",     1,"Rochester-MC",      4487,  9],
    ["Clarke",        3,"Ottumwa",           3498,  7],
    ["Clay",          4,"Rochester-MC",      6987, 13],
    ["Clayton",       1,"Cedar Rapids",      5498, 10],
    ["Clinton",       1,"Davenport",         9512, 18],
    ["Crawford",      4,"Sioux City",        5012, 10],
    ["Dallas",        3,"Des Moines",       27130, 55],
    ["Davis",         2,"Ottumwa",           3487,  7],
    ["Decatur",       3,"Ottumwa",           2998,  7],
    ["Delaware",      1,"Cedar Rapids",      5487, 10],
    ["Des Moines",    2,"Quincy-Keokuk",     7498, 14],
    ["Dickinson",     4,"Sioux Falls",       7012, 13],
    ["Dubuque",       1,"Cedar Rapids",     22134, 45],
    ["Emmet",         4,"Rochester-MC",      3987,  8],
    ["Fayette",       1,"Cedar Rapids",      5498, 10],
    ["Floyd",         1,"Rochester-MC",      5512, 10],
    ["Franklin",      4,"Rochester-MC",      4012,  8],
    ["Fremont",       3,"Omaha",             3487,  7],
    ["Greene",        4,"Des Moines",        4012,  8],
    ["Grundy",        4,"Cedar Rapids",      4012,  8],
    ["Guthrie",       3,"Des Moines",        5012,  9],
    ["Hamilton",      4,"Des Moines",        6487, 12],
    ["Hancock",       4,"Rochester-MC",      5012,  9],
    ["Hardin",        4,"Cedar Rapids",      6012, 11],
    ["Harrison",      4,"Omaha",             5487, 10],
    ["Henry",         2,"Quincy-Keokuk",     6012, 11],
    ["Howard",        1,"Rochester-MC",      3487,  7],
    ["Humboldt",      4,"Rochester-MC",      4012,  8],
    ["Ida",           4,"Sioux City",        3498,  7],
    ["Iowa",          2,"Cedar Rapids",      5012,  9],
    ["Jackson",       1,"Cedar Rapids",      5487, 10],
    ["Jasper",        3,"Des Moines",       12498, 23],
    ["Jefferson",     2,"Ottumwa",           4487,  9],
    ["Johnson",       2,"Cedar Rapids",     20261, 41],
    ["Jones",         1,"Cedar Rapids",      5498, 10],
    ["Keokuk",        2,"Ottumwa",           4012,  8],
    ["Kossuth",       4,"Rochester-MC",      5987, 11],
    ["Lee",           2,"Quincy-Keokuk",     7487, 14],
    ["Linn",          1,"Cedar Rapids",     43428, 88],
    ["Louisa",        2,"Davenport",         4012,  8],
    ["Lucas",         3,"Ottumwa",           4012,  8],
    ["Lyon",          4,"Sioux Falls",       6487, 12],
    ["Madison",       3,"Des Moines",        5987, 11],
    ["Mahaska",       2,"Des Moines",        7012, 13],
    ["Marion",        3,"Des Moines",       10987, 21],
    ["Marshall",      1,"Cedar Rapids",      9487, 18],
    ["Mills",         3,"Omaha",             5012,  9],
    ["Mitchell",      1,"Rochester-MC",      4487,  9],
    ["Monona",        4,"Sioux City",        3512,  7],
    ["Monroe",        2,"Ottumwa",           3012,  6],
    ["Montgomery",    3,"Omaha",             4487,  9],
    ["Muscatine",     2,"Davenport",         8987, 17],
    ["O'Brien",       4,"Sioux Falls",       6487, 12],
    ["Osceola",       4,"Sioux Falls",       3498,  7],
    ["Page",          3,"Ottumwa",           5498, 10],
    ["Palo Alto",     4,"Rochester-MC",      3512,  7],
    ["Plymouth",      4,"Sioux City",        7987, 15],
    ["Pocahontas",    4,"Sioux City",        3012,  6],
    ["Polk",          3,"Des Moines",       91892,184],
    ["Pottawattamie", 4,"Omaha",            25291, 50],
    ["Poweshiek",     3,"Des Moines",        5498, 10],
    ["Ringgold",      3,"Ottumwa",           2487,  5],
    ["Sac",           4,"Sioux City",        4498,  9],
    ["Scott",         2,"Davenport",        36484, 73],
    ["Shelby",        4,"Omaha",             5012,  9],
    ["Sioux",         4,"Sioux Falls",      10987, 20],
    ["Story",         3,"Des Moines",       18115, 36],
    ["Tama",          1,"Cedar Rapids",      5012,  9],
    ["Taylor",        3,"Ottumwa",           2998,  6],
    ["Union",         3,"Ottumwa",           4512,  9],
    ["Van Buren",     2,"Ottumwa",           3012,  6],
    ["Wapello",       2,"Ottumwa",           7498, 14],
    ["Warren",        3,"Des Moines",       14012, 27],
    ["Washington",    2,"Cedar Rapids",      6487, 12],
    ["Wayne",         3,"Ottumwa",           3498,  7],
    ["Webster",       4,"Des Moines",       10487, 20],
    ["Winnebago",     4,"Rochester-MC",      4487,  9],
    ["Winneshiek",    1,"Rochester-MC",      5498, 10],
    ["Woodbury",      4,"Sioux City",       23319, 47],
    ["Worth",         4,"Rochester-MC",      3012,  6],
    ["Wright",        4,"Rochester-MC",      5012,  9]
  ];

  var COUNTIES = RAW.map(function(r) {
    var pred = OVRD[r[0]] || CD_PRED[r[1]];
    var voters = r[3];
    var predTurnout = Math.round(STATEWIDE_TARGET * voters / STATEWIDE_VOTERS);
    return {
      county: r[0], cd: r[1], dma: r[2], voters: voters,
      precincts: r[4], pred: pred, predTurnout: predTurnout
    };
  });

  var TOP_COUNTIES = ["Polk","Linn","Scott","Dallas","Pottawattamie","Woodbury","Black Hawk","Dubuque","Johnson","Story"];

  /* Statewide predicted counts */
  var STATEWIDE_PRED = {};
  CAND_KEYS.forEach(function(k) {
    var total = 0;
    COUNTIES.forEach(function(c) { total += Math.round(c.predTurnout * c.pred[k]); });
    STATEWIDE_PRED[k] = total;
  });

  function setTarget(n) {
    var v = Math.max(1, Math.round(n) || 200000);
    STATEWIDE_TARGET = v;
    recalcPredictions();
    return v;
  }

  return {
    CAND_KEYS: CAND_KEYS,
    CAND_NAMES: CAND_NAMES,
    CAND_COLORS: CAND_COLORS,
    COUNTIES: COUNTIES,
    TOP_COUNTIES: TOP_COUNTIES,
    get STATEWIDE_TARGET() { return STATEWIDE_TARGET; },
    STATEWIDE_VOTERS: STATEWIDE_VOTERS,
    STATEWIDE_PRED: STATEWIDE_PRED,
    CD_PRED: CD_PRED,
    setTarget: setTarget
  };
})();

/* Also expose to Node (unified server seeds IA predictions from this) without
   affecting the browser global. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = IA_TRACKER;
}
