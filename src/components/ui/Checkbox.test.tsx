import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Checkbox } from "./Checkbox";

const render = (checked: boolean) =>
  renderToStaticMarkup(
    <Checkbox checked={checked} onChange={() => {}}>
      Send me appointment updates on WhatsApp
    </Checkbox>,
  );

describe("Checkbox (WhatsApp opt-in)", () => {
  it("renders unchecked when checked=false (never pre-ticked)", () => {
    const html = render(false);
    expect(html).toContain('type="checkbox"');
    expect(html).not.toMatch(/checked=""/);
    expect(html).toContain("Send me appointment updates on WhatsApp");
  });

  it("renders checked only when the caller says so", () => {
    expect(render(true)).toMatch(/checked=""/);
  });

  it("wraps the input in its label so the text is clickable", () => {
    expect(render(false)).toMatch(/^<label[^>]*>.*<input[^>]*type="checkbox"/);
  });
});
