const MEDSHAKE_BASE_URL = "https://www.medshake.net/pharmacie/concours-internat/annales";

const SESSIONS = [
  { id: "2026", label: "2026", year: 2026 },
  { id: "2025", label: "2025", year: 2025 },
  { id: "2024", label: "2024", year: 2024 },
  { id: "2023", label: "2023", year: 2023 },
  { id: "2022", label: "2022", year: 2022 },
  { id: "2021", label: "2021", year: 2021 },
  { id: "2020", label: "2020", year: 2020 },
  { id: "2019", label: "2019", year: 2019 },
  { id: "2018", label: "2018", year: 2018 },
  { id: "2017", label: "2017", year: 2017 },
  { id: "2016", label: "2016", year: 2016 },
  { id: "2015", label: "2015", year: 2015 },
  { id: "2014", label: "2014", year: 2014 },
  { id: "2013", label: "2013", year: 2013 },
  { id: "2012", label: "2012", year: 2012 },
  { id: "2011-nord", label: "2011 nord", year: 2011 },
  { id: "2011-sud", label: "2011 sud", year: 2011 },
  { id: "2010-nord", label: "2010 nord", year: 2010 },
  { id: "2010-sud", label: "2010 sud", year: 2010 },
  { id: "2009-nord", label: "2009 nord", year: 2009 },
  { id: "2009-sud", label: "2009 sud", year: 2009 },
  { id: "2007-nord", label: "2007 nord", year: 2007 },
  { id: "2007-sud", label: "2007 sud", year: 2007 },
  { id: "2006-nord", label: "2006 nord", year: 2006 },
  { id: "2006-sud", label: "2006 sud", year: 2006 },
  { id: "2005-nord", label: "2005 nord", year: 2005 },
  { id: "2005-sud", label: "2005 sud", year: 2005 },
  { id: "2004-nord", label: "2004 nord", year: 2004 },
  { id: "2004-sud", label: "2004 sud", year: 2004 },
  { id: "2003-nord", label: "2003 nord", year: 2003 },
  { id: "2003-sud", label: "2003 sud", year: 2003 },
  { id: "2002-nord", label: "2002 nord", year: 2002 },
  { id: "2002-sud", label: "2002 sud", year: 2002 },
  { id: "2001", label: "2001", year: 2001 },
  { id: "2000", label: "2000", year: 2000 },
  { id: "1999", label: "1999", year: 1999 },
  { id: "1998", label: "1998", year: 1998 },
  { id: "1997", label: "1997", year: 1997 },
  { id: "1996", label: "1996", year: 1996 },
  { id: "1995", label: "1995", year: 1995 },
  { id: "1994", label: "1994", year: 1994 },
  { id: "1993", label: "1993", year: 1993 },
  { id: "1992", label: "1992", year: 1992 },
  { id: "1991", label: "1991", year: 1991 },
];

const ANNALE_TYPES = [
  { id: "dossiers", label: "Dossiers", format: "PDF" },
  { id: "exercices", label: "Exercices", format: "PDF" },
  { id: "qcm", label: "QCM", format: "HTML" },
];

function annaleUrl(type, sessionId) {
  if (type === "qcm") return `${MEDSHAKE_BASE_URL}/qcm/voir/${sessionId}/`;
  return `${MEDSHAKE_BASE_URL}/pdf/${type}${sessionId}.pdf`;
}

export const ANNALE_CATALOG = SESSIONS.flatMap((session) =>
  ANNALE_TYPES.map((type) => ({
    id: `${session.id}-${type.id}`,
    sessionId: session.id,
    year: session.year,
    label: `${type.label} ${session.label}`,
    sessionLabel: session.label,
    type: type.id,
    typeLabel: type.label,
    format: type.format,
    url: annaleUrl(type.id, session.id),
  })),
);

export const ANNALE_TYPE_OPTIONS = ANNALE_TYPES.map((type) => ({
  id: type.id,
  label: type.label,
}));

export const ANNALE_YEAR_OPTIONS = [...new Set(SESSIONS.map((session) => session.year))]
  .sort((a, b) => b - a)
  .map((year) => ({ id: String(year), label: String(year) }));

export function getAnnaleById(annaleId) {
  return ANNALE_CATALOG.find((annale) => annale.id === annaleId) || null;
}

export function getRecentAnnales(limit = 60) {
  return ANNALE_CATALOG.slice(0, limit);
}
