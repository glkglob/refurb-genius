import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem } from "@repo/ui";

describe("Menubar (migrated @repo/ui)", () => {
  it("renders menubar with menu trigger and items structure", () => {
    render(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>File</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>New</MenubarItem>
            <MenubarItem>Open</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>,
    );

    expect(screen.getByText("File")).toBeInTheDocument();
    // Content not visible until interaction
    expect(screen.queryByText("New")).not.toBeInTheDocument();
  });
});
