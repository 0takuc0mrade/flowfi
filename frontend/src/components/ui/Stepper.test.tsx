import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stepper } from "./Stepper";

const steps = ["Connect", "Configure", "Confirm"];

describe("Stepper", () => {
  it("renders every step inside an accessible Progress landmark", () => {
    render(<Stepper steps={steps} currentStep={1} />);
    expect(
      screen.getByRole("navigation", { name: "Progress" })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Connect")).toBeInTheDocument();
    expect(screen.getByText("Configure")).toBeInTheDocument();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
  });

  it("marks only the active step with aria-current=step", () => {
    render(<Stepper steps={steps} currentStep={2} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[2]).not.toHaveAttribute("aria-current");
  });

  it("applies completed/active/upcoming classes per step index", () => {
    const { container } = render(<Stepper steps={steps} currentStep={2} />);
    const circles = container.querySelectorAll(".stepper__circle");
    const labels = container.querySelectorAll(".stepper__label");

    expect(circles[0].className).toContain("stepper__circle--completed");
    expect(circles[1].className).toContain("stepper__circle--active");
    expect(circles[2].className).toContain("stepper__circle--upcoming");

    expect(labels[0].className).toContain("stepper__label--completed");
    expect(labels[1].className).toContain("stepper__label--active");
    expect(labels[2].className).toContain("stepper__label--upcoming");
  });

  it("adds the matching screen-reader suffix to each step", () => {
    render(<Stepper steps={steps} currentStep={2} />);
    expect(screen.getByText("(completed)")).toBeInTheDocument();
    expect(screen.getByText("(current step)")).toBeInTheDocument();
    expect(screen.getByText("(upcoming)")).toBeInTheDocument();
  });

  it("shows a check icon for completed steps and a number otherwise", () => {
    const { container } = render(<Stepper steps={steps} currentStep={2} />);
    const circles = container.querySelectorAll(".stepper__circle");

    expect(circles[0].querySelector("svg")).not.toBeNull();
    expect(circles[1].querySelector("svg")).toBeNull();
    expect(circles[2].querySelector("svg")).toBeNull();
    expect(circles[1].querySelector(".stepper__number")?.textContent).toBe("2");
    expect(circles[2].querySelector(".stepper__number")?.textContent).toBe("3");
  });
});
