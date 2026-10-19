import { describe, expect, it } from "vitest";
import { windowsProgram } from "../src/windowsAppLauncher";

describe("windowsProgram", () => {
  it("maps everyday names to the program Windows knows", () => {
    expect(windowsProgram("Excel")).toBe("excel");
    expect(windowsProgram("Microsoft Word")).toBe("winword");
    expect(windowsProgram("PowerPoint")).toBe("powerpnt");
    expect(windowsProgram("Calculator")).toBe("calc");
    expect(windowsProgram("Microsoft Edge")).toBe("msedge");
  });

  it("passes other names through, without .exe", () => {
    expect(windowsProgram("Slack")).toBe("slack");
    expect(windowsProgram("notepad.exe")).toBe("notepad");
  });
});
