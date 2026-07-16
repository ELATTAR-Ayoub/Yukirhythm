import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/forms/login";
import { makeAuthValue } from "@/test/mocks";

// LoginForm calls useAuth() for signin/signinPopup; config/firebase.ts (which
// the real AuthContext imports) calls initializeApp() at module scope and
// throws in tests, so mock the context outright.
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => makeAuthValue(),
}));

describe("LoginForm", () => {
  it("renders the email and password fields with their labels and placeholders", () => {
    render(<LoginForm />);

    // The email/password fields are always mounted (the wrapper is only
    // visually collapsed via a height-0/overflow-hidden class before "Login
    // with Email" is clicked, not removed from the DOM), so they're
    // queryable without simulating that click.
    //
    // This is also the tripwire for the zod 4 / @hookform/resolvers 5
    // upgrade in 4D: if useForm's zodResolver wiring breaks, react-hook-form
    // won't register these fields and the query-by-label lookups below fail.
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Yuki@contact.com")).toBeInTheDocument();

    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("our small secret")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: /submit/i })).toBeInTheDocument();
  });
});
