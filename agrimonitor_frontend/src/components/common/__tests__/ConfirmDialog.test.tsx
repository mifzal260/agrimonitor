import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  it("does not render when closed", () => {
    render(
      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Delete"
        isOpen={false}
        message="Delete this record?"
        title="Confirm"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders an accessible confirmation dialog", () => {
    render(
      <ConfirmDialog
        cancelLabel="Batal"
        confirmLabel="Padam"
        isOpen
        message="Padam rekod ini?"
        title="Sahkan"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Sahkan" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("Padam rekod ini?");
    expect(screen.getByRole("button", { name: "Padam" })).toHaveFocus();
  });

  it("calls confirm and cancel handlers", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Delete"
        isOpen
        message="Delete this record?"
        title="Confirm"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("closes with Escape and backdrop when not loading", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const { rerender } = render(
      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Delete"
        isOpen
        message="Delete this record?"
        title="Confirm"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);

    onCancel.mockClear();
    rerender(
      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Delete"
        isOpen
        message="Delete this record?"
        title="Confirm"
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate actions while loading", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Deleting..."
        isLoading
        isOpen
        message="Delete this record?"
        title="Confirm"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Deleting..." }));
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("dialog").parentElement as HTMLElement);

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
  });

  it("restores focus to the opener after closing", async () => {
    const user = userEvent.setup();
    const opener = document.createElement("button");
    opener.textContent = "Open dialog";
    document.body.appendChild(opener);
    opener.focus();

    const { rerender } = render(
      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Delete"
        isOpen
        message="Delete this record?"
        title="Confirm"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete" })).toHaveFocus();

    rerender(
      <ConfirmDialog
        cancelLabel="Cancel"
        confirmLabel="Delete"
        isOpen={false}
        message="Delete this record?"
        title="Confirm"
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(opener).toHaveFocus();
    await user.tab();
    opener.remove();
  });
});
