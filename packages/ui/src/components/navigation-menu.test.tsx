import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@repo/ui";

describe("NavigationMenu (migrated @repo/ui)", () => {
  it("renders navigation menu with list, trigger and link", () => {
    render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
            <NavigationMenuContent>
              <NavigationMenuLink href="/docs">Documentation</NavigationMenuLink>
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>,
    );

    expect(screen.getByText("Getting started")).toBeInTheDocument();
    // Content hidden until open
    expect(screen.queryByText("Documentation")).not.toBeInTheDocument();
  });
});
