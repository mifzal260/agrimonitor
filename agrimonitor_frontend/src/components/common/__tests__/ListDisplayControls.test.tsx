import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import i18n from "../../../i18n";
import { INITIAL_VISIBLE_LIST_COUNT } from "../../../utils/listDisplay";
import { ListDisplayControls } from "../ListDisplayControls";

describe("ListDisplayControls", () => {
  it.each([0, 1, 8])("does not render controls for %s records", (totalItems) => {
    render(<ListDisplayControls totalItems={totalItems} visibleCount={INITIAL_VISIBLE_LIST_COUNT} onVisibleCountChange={vi.fn()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("expands and collapses records with Malay labels", async () => {
    await i18n.changeLanguage("ms");
    const user = userEvent.setup();
    const onVisibleCountChange = vi.fn();
    const { rerender } = render(<ListDisplayControls totalItems={9} visibleCount={8} onVisibleCountChange={onVisibleCountChange} />);

    expect(screen.getByText("Memaparkan 8 daripada 9 rekod")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lihat lagi" }));
    expect(onVisibleCountChange).toHaveBeenCalledWith(9);

    rerender(<ListDisplayControls totalItems={9} visibleCount={9} onVisibleCountChange={onVisibleCountChange} />);
    await user.click(screen.getByRole("button", { name: "Tutup semula" }));
    expect(onVisibleCountChange).toHaveBeenCalledWith(8);
  });

  it("uses English labels when the app language changes", async () => {
    await i18n.changeLanguage("en");
    render(<ListDisplayControls totalItems={17} visibleCount={16} onVisibleCountChange={vi.fn()} />);

    expect(screen.getByText("Showing 16 of 17 records")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show more" })).toHaveAttribute("type", "button");
  });
});
