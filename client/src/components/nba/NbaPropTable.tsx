import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { DensePropTable } from "@/components/research";
import { type NbaProp } from "@/data/nbaMock";
import { nbaToBuilderLeg } from "@/lib/builderMappers";

export function NbaPropTable({
  rows,
  title = "Prop Board",
  subtitle = "Projection · edge · L5–Season hit rates · confidence",
  platformLabel,
}: {
  rows: NbaProp[];
  title?: string;
  subtitle?: string;
  platformLabel?: string | null;
}) {
  const { addLeg, hasLeg } = useParlayDraft();

  return (
    <DensePropTable
      rows={rows}
      title={title}
      subtitle={subtitle}
      platformLabel={platformLabel}
      hasLeg={hasLeg}
      onAdd={(row) => {
        const full = rows.find((r) => r.id === row.id);
        if (full) addLeg(nbaToBuilderLeg(full));
      }}
    />
  );
}
