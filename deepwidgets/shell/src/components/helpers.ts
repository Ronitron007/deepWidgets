type ElementLike = {
  type: "element";
  props: Record<string, unknown>;
};

/** Text of one cell or label. A non-text value prints as JSON, not as [object Object]. */
export function cellText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function hasAllProps(obj: Record<string, unknown>, ...keys: string[]): boolean {
  return keys.every((k) => obj[k] != null);
}

export function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (v == null) return [];
  return [v];
}

function asElementNodes(v: unknown): ElementLike[] {
  return asArray(v).filter(
    (x): x is ElementLike =>
      typeof x === "object" && x !== null && (x as Record<string, unknown>)["type"] === "element",
  );
}

export function buildChartData(
  labels: unknown,
  series: unknown,
): Record<string, string | number>[] {
  const lbls = asArray(labels) as string[];

  const rows = asArray(series);
  if (rows.length > 0 && Array.isArray(rows[0])) {
    const seriesNames = lbls.slice(1);
    return rows.map((row) => {
      const cells = row as unknown[];
      const point: Record<string, string | number> = { category: cellText(cells[0]) };
      seriesNames.forEach((name, si) => {
        const val = cells[si + 1];
        point[name] = typeof val === "number" ? val : Number(val) || 0;
      });
      return point;
    });
  }

  const seriesNodes = asElementNodes(series);
  return lbls.map((label, i) => {
    const point: Record<string, string | number> = { category: label };
    seriesNodes.forEach((s) => {
      const cat = s.props["category"];
      const vals = s.props["values"];
      if (typeof cat === "string" && Array.isArray(vals) && i < vals.length) {
        const value: unknown = vals[i];
        if (typeof value === "number" || typeof value === "string") point[cat] = value;
      }
    });
    return point;
  });
}

export function buildSliceData(slices: unknown): Record<string, string | number>[] {
  return asElementNodes(slices).map((s) => ({
    category: s.props["category"] as string,
    value: s.props["value"] as number,
  }));
}
