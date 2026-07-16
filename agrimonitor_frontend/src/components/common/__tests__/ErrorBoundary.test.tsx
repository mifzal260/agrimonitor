import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorBoundary } from "../ErrorBoundary";

function BrokenComponent() {
  throw new Error("Sensitive stack trace should stay out of the DOM");
  return <div />;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("renders a safe fallback and reload button when a render error occurs", () => {
    window.addEventListener("error", (event) => event.preventDefault(), { once: true });

    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/halaman tidak dapat dipaparkan|page could not be displayed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /muat semula aplikasi|reload application/i })).toBeInTheDocument();
    expect(screen.queryByText(/Sensitive stack trace/)).not.toBeInTheDocument();
  });
});


