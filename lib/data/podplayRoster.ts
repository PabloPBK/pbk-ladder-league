export type ParsedCsvRow = Record<string, string>;

const ratingHeaders = [
  "ratings doubles",
  "dupr doubles",
  "dupr doubles rating",
  "doubles rating",
  "dupr rating",
  "dupr",
  "doubles dupr",
];

export function getPodPlayImportFields(row: ParsedCsvRow) {
  const fields = new Map(Object.entries(row).map(([header, value]) => [header.toLowerCase(), value]));
  const ratingHeader = ratingHeaders.find((header) => fields.has(header));
  const rating = ratingHeader ? fields.get(ratingHeader)?.trim() ?? "" : "";
  return {
    email: fields.get("email") || fields.get("email address") || "",
    duprId: fields.get("dupr id") || fields.get("dupr player id") || "",
    duprText: /^(not rated|unrated|n\/a|-)$/i.test(rating) ? "" : rating,
  };
}

export function parsePodPlayCsv(text: string): ParsedCsvRow[] {
  const cleanedText = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < cleanedText.length; index += 1) {
    const character = cleanedText[index];
    const nextCharacter = cleanedText[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (
      (character === "\n" || character === "\r") &&
      !insideQuotes
    ) {
      if (
        character === "\r" &&
        nextCharacter === "\n"
      ) {
        index += 1;
      }

      row.push(cell);
      cell = "";

      if (row.some((value) => value.trim())) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    cell += character;
  }

  row.push(cell);

  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  const [headers, ...dataRows] = rows;

  if (!headers) {
    return [];
  }

  return dataRows.map((values) =>
    headers.reduce<ParsedCsvRow>(
      (record, header, columnIndex) => {
        record[header.trim()] =
          values[columnIndex]?.trim() ?? "";
        return record;
      },
      {},
    ),
  );
}
