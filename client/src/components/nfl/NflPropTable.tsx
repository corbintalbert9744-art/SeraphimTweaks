import { useParlayDraft } from "@/components/parlay/ParlayDraftContext";
import { DensePropTable } from "@/components/research";
import { type NflProp } from "@/data/nflMock";
import { nflToBuilderLeg } from "@/lib/builderMappers";

export function NflPropTable({
  rows,
  platformLabel,
}: {
  rows: NflProp[];
  platformLabel?: string | null;
}) {
  const { addLeg, hasLeg } = useParlayDraft();

  return (
    <DensePropTable
      rows={rows}
      title={`NFL${platformLabel ? ` · ${platformLabel}` : ""} Prop Board`}
      subtitle="Projection · edge · L5–Season hit rates · confidence"
      platformLabel={platformLabel}
      hasLeg={hasLeg}
      onAdd={(row) => {
        const full = rows.find((r) => r.id === row.id);
        if (full) addLeg(nflToBuilderLeg(full));
      }}
    />
  );
}
