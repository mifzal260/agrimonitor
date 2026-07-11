import { useEffect, useState } from "react";

import { StatusBadge } from "../../components/StatusBadge";
import { CommodityPriceAccordion } from "./CommodityPriceAccordion";
import type { CommodityPriceGroup } from "./priceTrendUtils";

type CommodityPriceAccordionListProps = {
  groups: CommodityPriceGroup[];
  selectedPriceType: string;
};

export function CommodityPriceAccordionList({ groups, selectedPriceType }: CommodityPriceAccordionListProps) {
  const [openCommodity, setOpenCommodity] = useState<string | null>(null);

  useEffect(() => {
    if (openCommodity && !groups.some((group) => group.commodityName === openCommodity)) {
      setOpenCommodity(null);
    }
  }, [groups, openCommodity]);

  return (
    <section className="scroll-mt-24 rounded-lg border border-field-100 bg-white p-4 shadow-sm" id="senarai-harga-pasaran">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">Harga mengikut komoditi</h2>
          <p className="mt-1 text-sm text-slate-600">Buka satu komoditi untuk melihat harga Ladang, Borong dan Runcit.</p>
        </div>
        <StatusBadge label={groups.length + " komoditi"} tone="info" />
      </div>

      {groups.length === 0 ? (
        <p className="mt-4 rounded-lg bg-field-50 p-4 text-sm text-slate-600">
          Tiada harga pasaran sepadan dengan filter ini. Kosongkan filter atau tekan Reset.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {groups.map((group) => (
            <CommodityPriceAccordion
              group={group}
              isOpen={openCommodity === group.commodityName}
              key={group.commodityName}
              selectedPriceType={selectedPriceType}
              onToggle={() => setOpenCommodity((current) => current === group.commodityName ? null : group.commodityName)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
