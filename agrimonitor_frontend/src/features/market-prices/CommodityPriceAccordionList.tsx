import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { StatusBadge } from "../../components/StatusBadge";
import { CommodityPriceAccordion } from "./CommodityPriceAccordion";
import type { CommodityPriceGroup } from "./priceTrendUtils";

type CommodityPriceAccordionListProps = {
  groups: CommodityPriceGroup[];
  selectedPriceType: string;
};

export function CommodityPriceAccordionList({ groups, selectedPriceType }: CommodityPriceAccordionListProps) {
  const { t } = useTranslation();
  const [openCommodity, setOpenCommodity] = useState<string | null>(null);

  useEffect(() => {
    if (openCommodity && !groups.some((group) => group.groupKey === openCommodity)) {
      setOpenCommodity(null);
    }
  }, [groups, openCommodity]);

  return (
    <section className="scroll-mt-24 rounded-lg border border-field-100 bg-white p-4 shadow-sm" id="senarai-harga-pasaran">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-slate-950">{t("marketPrice.marketPriceRecords")}</h2>
          <p className="mt-1 text-sm text-slate-600">{t("marketPrice.dailySummaryDescription")}</p>
        </div>
        <StatusBadge label={groups.length + " " + t("marketPrice.updatedCommodities")} tone="info" />
      </div>

      {groups.length === 0 ? (
        <p className="mt-4 rounded-lg bg-field-50 p-4 text-sm text-slate-600">
          {t("emptyState.noMarketPrices")}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {groups.map((group) => (
            <CommodityPriceAccordion
              group={group}
              isOpen={openCommodity === group.groupKey}
              key={group.groupKey}
              selectedPriceType={selectedPriceType}
              onToggle={() => setOpenCommodity((current) => current === group.groupKey ? null : group.groupKey)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

