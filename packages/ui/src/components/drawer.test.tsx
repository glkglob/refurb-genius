import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@repo/ui";

describe("Drawer (migrated @repo/ui)", () => {
  it("renders drawer trigger and basic content structure", () => {
    render(
      <Drawer>
        <DrawerTrigger>Open Drawer</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Drawer Title</DrawerTitle>
          </DrawerHeader>
          <div>Body content</div>
          <DrawerClose>Close</DrawerClose>
        </DrawerContent>
      </Drawer>,
    );

    expect(screen.getByText("Open Drawer")).toBeInTheDocument();
    // Content portaled, not in DOM until open (vaul)
    expect(screen.queryByText("Drawer Title")).not.toBeInTheDocument();
  });
});
